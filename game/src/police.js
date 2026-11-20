// V2: the wanted scale is six stars (MAX_WANTED = 6) with red evidence icons
// in the HUD, and the minimap tints red-pink while the police are searching.
// Chase, ram and busted logic are unchanged.
// The wanted system and the Solara Bay police. Stars rise when the player steals,
// hits a pedestrian or shoots; police cars spawn to match the level and chase the
// player down, ramming the car or cornering the player on foot. Out of sight long
// enough, the heat fades one star at a time.
import { CITY_HALF, MAX_WANTED, PITCH, SBPD_CALLSIGNS } from './config.js';
import { collideCar, makeCar } from './vehicles.js';
import { randomStreetPoint } from './city.js';

/** How many police cars a wanted level fields. */
function policeForLevel(wanted) {
  return wanted === 0 ? 0 : Math.min(1 + Math.floor(wanted / 2), 4);
}

export function createPolice(g) {
  const police = {
    cars: [],
    unseenTimer: 0,
    decayTimer: 0,
    bustedTimer: 0,
    sirenOn: false,
    searching: false, // wanted, but no cruiser in sight: the map tints red-pink
    callsigns: [...SBPD_CALLSIGNS],
    /** Give a cruiser the next free beach-patrol callsign (staged scenes call
     * this too, so every unit on the dispatch board has a real name). */
    tag(car) {
      if (!car.callsign) car.callsign = police.callsigns.shift() || 'SBPD';
      return car.callsign;
    },
    addWanted(n, reason) {
      if (g.wanted >= MAX_WANTED) return;
      g.wanted = Math.min(MAX_WANTED, g.wanted + n);
      g.hud.setWanted(g.wanted);
      if (reason) g.hud.feed(`${reason} — wanted level ${g.wanted}.`);
    },
    clearWanted() {
      g.wanted = 0;
      g.hud.setWanted(0);
    },
  };
  g.police = police;
  return police;
}

function spawnPoliceCar(g) {
  // Spawn on a street 70-110 m from the player, so they arrive, not appear.
  let x = 0;
  let z = 0;
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomStreetPoint(g.rng);
    const d = Math.hypot(p.x - g.player.x, p.z - g.player.z);
    if (d > 70 && d < 120) {
      x = p.x;
      z = p.z;
      break;
    }
    x = p.x;
    z = p.z;
  }
  const car = makeCar(g, x, z, 0, 0x1d3fae, 'police');
  car.speed = 0;
  car.cruise = 28;
  g.police.tag(car);
  g.police.cars.push(car);
  return car;
}

export function updatePolice(g, dt) {
  const police = g.police;
  const want = policeForLevel(g.wanted);
  while (police.cars.length < want) spawnPoliceCar(g);
  while (police.cars.length > want) {
    const car = police.cars.pop();
    g.scene.remove(car.mesh);
    const index = g.cars.indexOf(car);
    if (index >= 0) g.cars.splice(index, 1);
  }

  // Nearest police distance drives the wanted decay and the siren.
  let nearest = Infinity;
  for (const car of police.cars) {
    const d = Math.hypot(car.x - g.player.x, car.z - g.player.z);
    if (d < nearest) nearest = d;
  }
  police.sirenOn = g.wanted > 0 && nearest < 120;
  police.searching = g.wanted > 0 && nearest > 90;
  g.audio.siren(police.sirenOn, dt);

  if (g.wanted > 0 && nearest > 90) {
    police.unseenTimer += dt;
    if (police.unseenTimer > 8) {
      police.decayTimer += dt;
      if (police.decayTimer > 4) {
        police.decayTimer = 0;
        g.wanted -= 1;
        g.hud.setWanted(g.wanted);
        g.hud.feed(g.wanted === 0 ? 'You lost the cops.' : `Heat dying down — wanted level ${g.wanted}.`);
      }
    }
  } else {
    police.unseenTimer = 0;
    police.decayTimer = 0;
  }

  for (const car of police.cars) {
    if (car.disabled) continue;
    // Pure pursuit: steer toward the player, faster than traffic, ramming close in.
    const dx = g.player.x - car.x;
    const dz = g.player.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3 * dt));
    const targetSpeed = dist > 10 ? 30 : 20;
    car.speed += Math.max(-10 * dt, Math.min(8 * dt, targetSpeed - car.speed));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    collideCar(g, car, 1.7);
    // Ram the player's car: shove it and hurt the player a little. The drag and
    // the damage are per second, not per frame, so two cruisers harass instead
    // of stopping the car dead in under a second.
    const playerCar = g.player.car;
    if (playerCar && dist < 4.2) {
      playerCar.speed -= Math.sign(playerCar.speed) * 1.5 * dt;
      g.player.health = Math.max(0, g.player.health - 3 * dt);
      if (g.player.health <= 0) g.wasted();
    }
    // Cornered on foot: stand still too long and it is over.
    if (!playerCar && dist < 3.5 && g.wanted > 0) {
      police.bustedTimer += dt;
      if (police.bustedTimer > 2.5) g.busted();
    } else {
      police.bustedTimer = Math.max(0, police.bustedTimer - dt);
    }
    // Light bar flashes red and blue.
    car.flash += dt * 8;
    if (car.mesh.userData.lightBar) {
      car.mesh.userData.lightBar.material.color.setHex(Math.floor(car.flash) % 2 === 0 ? 0x2244ff : 0xff2222);
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}
