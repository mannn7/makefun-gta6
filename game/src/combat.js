// Combat, modest but real: F punches whoever is close, 2 draws the pistol and a
// mouse click fires a hitscan shot with a muzzle flash, and health and ammo
// pickups wait on street corners. Shooting or punching a local raises the heat.
import * as THREE from 'three';
import { CITY_HALF } from './config.js';

const PICKUP_COUNT = 6;

function createPickupMesh(kind) {
  const group = new THREE.Group();
  const color = kind === 'health' ? 0x2ecc71 : 0xf2c94c;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color }));
  box.position.y = 0.8;
  group.add(box);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 }),
  );
  glow.position.y = 0.8;
  group.add(glow);
  if (kind === 'health') {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.72), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cross.position.y = 0.8;
    group.add(cross);
  }
  return group;
}

export function spawnPickups(g) {
  for (let i = 0; i < PICKUP_COUNT; i += 1) {
    const kind = i % 2 === 0 ? 'health' : 'ammo';
    const mesh = createPickupMesh(kind);
    const x = g.rng.range(-CITY_HALF + 20, CITY_HALF - 20);
    const z = g.rng.range(-CITY_HALF + 20, CITY_HALF - 20);
    mesh.position.set(x, 0, z);
    g.scene.add(mesh);
    g.pickups.push({ mesh, kind, x, z, active: true, respawn: 0 });
  }
}

/** A short-lived muzzle flash: a bright sprite and a point light at the gun. */
function muzzleFlash(g) {
  if (g.muzzle) {
    g.muzzle.visible = true;
    g.muzzle.material.opacity = 0.95;
    g.muzzleLight.intensity = 6;
    g.muzzleTimer = 0.06;
  }
}

/** Fire the pistol along the camera's aim: the nearest thing in the crosshair takes it. */
function shoot(g) {
  const p = g.player;
  if (p.ammo <= 0) {
    g.hud.feed('Out of ammo — find a yellow pickup.');
    return;
  }
  p.ammo -= 1;
  g.audio.gunshot();
  g.shotNoise = 2;
  muzzleFlash(g);
  const dir = new THREE.Vector3();
  g.camera.getWorldDirection(dir);
  const origin = g.camera.position.clone();
  // Targets: pedestrians, police cars, traffic cars.
  let best = null;
  let bestT = 60;
  function testSphere(cx, cz, cy, radius, target) {
    const ox = cx - origin.x;
    const oy = cy - origin.y;
    const oz = cz - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0 || t > bestT) return;
    const px = origin.x + dir.x * t - cx;
    const py = origin.y + dir.y * t - cy;
    const pz = origin.z + dir.z * t - cz;
    if (px * px + py * py + pz * pz < radius * radius) {
      bestT = t;
      best = target;
    }
  }
  for (const ped of g.peds) {
    if (ped.down > 0) continue;
    testSphere(ped.x, ped.z, 1.0, 0.9, { type: 'ped', ped });
  }
  for (const car of g.cars) {
    if (car.kind === 'player') continue;
    testSphere(car.x, car.z, 0.8, 2.6, { type: 'car', car });
  }
  if (!best) return;
  if (best.type === 'ped') {
    best.ped.down = 8;
    best.ped.mesh.rotation.x = -Math.PI / 2;
    best.ped.mesh.position.y = 0.3;
    g.police.addWanted(1, 'Shots fired');
    g.hud.feed('You shot a local! Wanted level up.');
  } else {
    const car = best.car;
    car.health -= 34;
    if (car.kind === 'police' && car.health <= 0 && !car.disabled) {
      car.disabled = true;
      car.speed = 0;
      g.hud.feed('Police car disabled!');
      g.cash += 50;
    } else if (car.kind === 'traffic') {
      g.police.addWanted(1, 'You shot at a car');
    }
  }
}

export function updateCombat(g, dt, input) {
  const p = g.player;
  if (p.car) return; // No fighting from the driver's seat.
  // Weapon swap.
  if (input.pressed('Digit1')) {
    p.armed = false;
    g.hud.setArmed(false);
  } else if (input.pressed('Digit2')) {
    p.armed = true;
    g.hud.setArmed(true);
    g.hud.feed('Pistol drawn. Click to fire.');
  }
  // Punch.
  if (input.pressed('KeyF') && p.punchCooldown <= 0) {
    p.punchCooldown = 0.4;
    g.audio.punch();
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    for (const ped of g.peds) {
      if (ped.down > 0) continue;
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      if (Math.hypot(dx, dz) < 2.2 && dx * fx + dz * fz > 0) {
        ped.down = 6;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.3;
        g.police.addWanted(1, 'Assault');
        g.hud.feed('You punched a local! Wanted level up.');
      }
    }
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  // Pistol: the input's mouseDown fires on click (handled in main via input.clicked()).
  if (p.armed && input.pressed('MouseClick')) shoot(g);
  // Muzzle flash fades.
  if (g.muzzleTimer > 0) {
    g.muzzleTimer -= dt;
    if (g.muzzleTimer <= 0 && g.muzzle) {
      g.muzzle.visible = false;
      g.muzzleLight.intensity = 0;
    }
  }
  // Pickups: walk over one to take it; they respawn after 30 s.
  for (const pk of g.pickups) {
    if (!pk.active) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        pk.active = true;
        pk.mesh.visible = true;
      }
      continue;
    }
    pk.mesh.rotation.y += dt;
    pk.mesh.position.y = Math.sin(g.time * 2 + pk.x) * 0.08;
    const d = Math.hypot(pk.x - p.x, pk.z - p.z);
    if (d < 1.6) {
      pk.active = false;
      pk.mesh.visible = false;
      pk.respawn = 30;
      if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + 30);
        g.hud.feed('Health +30.');
      } else {
        p.ammo = Math.min(48, p.ammo + 12);
        g.hud.feed('Ammo +12.');
      }
      g.audio.blip();
    }
  }
}
