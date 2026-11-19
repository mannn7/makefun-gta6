// V2: the stolen-car feed text is "Car theft" — the series name is gone from
// the HUD. Car meshes, arcade driving, collision and steal logic are otherwise
// unchanged from v1.
// Cars: a boxy mesh factory (body, cabin, wheels, headlights), parked cars, and the
// player's arcade driving — accelerate, brake, reverse, steer that bites harder
// the faster you go, handbrake drift, and simple circle-vs-building collision so a
// car slides along walls instead of stopping dead. E near a car steals it.
import * as THREE from 'three';
import { CAR_ACCEL, CAR_BRAKE, CAR_LENGTH, CAR_MAX_SPEED, CAR_REVERSE_MAX, CAR_WIDTH, CITY_HALF, PALETTE } from './config.js';
import { randomStreetPoint } from './city.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });

/** A low-poly car: body, cabin, four wheels, headlights and a tail light bar. */
export function createCarMesh(colorHex, police = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH, 0.62, CAR_LENGTH), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH - 0.3, 0.55, CAR_LENGTH * 0.5), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelPositions = [
    [-0.85, 0.36, 1.45],
    [0.85, 0.36, 1.45],
    [-0.85, 0.36, -1.45],
    [0.85, 0.36, -1.45],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const x of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), lightMat);
    light.position.set(x, 0.62, CAR_LENGTH / 2 + 0.01);
    group.add(light);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH - 0.4, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xd21f1f }));
  tail.position.set(0, 0.66, -CAR_LENGTH / 2 - 0.01);
  group.add(tail);
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.45, -0.2);
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH + 0.02, 0.2, CAR_LENGTH + 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
    group.userData.lightBar = bar;
  }
  group.userData.wheels = group.children.filter((c) => c.geometry === wheelGeo);
  return group;
}

/** A car in the world: mesh, position, heading, speed and who drives it. */
export function makeCar(g, x, z, heading, colorHex, kind) {
  const police = kind === 'police';
  const mesh = createCarMesh(police ? PALETTE.police : colorHex, police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  g.scene.add(mesh);
  const car = {
    mesh,
    x,
    z,
    heading,
    speed: 0,
    color: colorHex,
    kind, // 'parked' | 'traffic' | 'police' | 'player'
    steer: 0,
    health: 100,
    disabled: false,
    flash: 0,
  };
  g.cars.push(car);
  return car;
}

/** Parked cars along the street edges, ready to be stolen. */
export function spawnParkedCars(g) {
  for (let i = 0; i < 14; i += 1) {
    const p = randomStreetPoint(g.rng);
    const alongX = Math.abs(p.z % 58) < 0.01 || g.rng.chance(0.5);
    const heading = alongX ? (g.rng.chance(0.5) ? 0 : Math.PI) : (g.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const offset = alongX ? 4.6 : -4.6;
    const car = makeCar(g, alongX ? p.x : p.x + offset, alongX ? p.z + offset : p.z, heading, g.rng.pick(PALETTE.car), 'parked');
    car.speed = 0;
  }
}

/** The nearest car the player could steal, within maxDist metres. */
export function nearestCar(g, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of g.cars) {
    if (car.kind === 'player') continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Push a circle (the car) out of every building footprint and the city bounds. */
export function collideCar(g, car, radius = 1.7) {
  for (const b of g.city.buildingBoxes) {
    const cx = Math.max(b.minX, Math.min(car.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(car.z, b.maxZ));
    const dx = car.x - cx;
    const dz = car.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      const push = (radius - d) / d;
      car.x += dx * push;
      car.z += dz * push;
      car.speed *= 0.55;
      if (car.kind === 'player' && Math.abs(car.speed) > 4) g.audio.crash();
    }
  }
  const lim = CITY_HALF + 58;
  if (car.x < -lim) car.x = -lim;
  if (car.x > lim) car.x = lim;
  if (car.z < -lim) car.z = -lim;
  if (car.z > lim + 58) car.z = lim + 58;
  // Simple car-vs-car push apart.
  for (const other of g.cars) {
    if (other === car || other.kind === 'player') continue;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 3.4) {
      const push = (3.4 - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      car.x += nx * push;
      car.z += nz * push;
      other.x -= nx * push;
      other.z -= nz * push;
      const exchange = car.speed * 0.4;
      car.speed *= 0.6;
      other.speed = exchange;
    }
  }
}

/** Arcade driving for the car the player is in. */
export function updatePlayerCar(g, dt, input) {
  const car = g.player.car;
  if (!car) return;
  const axis = input.moveAxis();
  const handbrake = input.held('Space');
  if (axis.y > 0) car.speed += CAR_ACCEL * dt * (car.speed < 0 ? 2.2 : 1);
  else if (axis.y < 0) {
    if (car.speed > 0.5) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.7 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 14 * dt);
  }
  car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_MAX_SPEED, car.speed));
  const steerTarget = -axis.x * (car.speed >= 0 ? 1 : -1);
  const steerRate = handbrake ? 2.6 : 1.9;
  const grip = handbrake ? 0.55 : 1;
  car.heading += steerTarget * steerRate * (Math.abs(car.speed) / CAR_MAX_SPEED) * grip * dt * (car.speed >= 0 ? 1 : -1) * Math.sign(car.speed || 1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  collideCar(g, car);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // The player rides with the car.
  g.player.x = car.x;
  g.player.z = car.z;
  g.player.heading = car.heading;
  g.audio.setEngine(Math.abs(car.speed), true);
}

/** Steal the car: the player vanishes into the driver's seat. */
export function enterCar(g, car) {
  if (car.kind === 'parked' || car.kind === 'traffic') {
    if (car.kind === 'parked') {
      g.police.addWanted(1, 'Car theft');
      g.hud.feed('You stole a car! The cops are onto you.');
    }
    car.kind = 'player';
    g.player.car = car;
    g.player.mesh.visible = false;
    g.audio.blip();
  }
}

/** Step out beside the car, on foot again. */
export function exitCar(g) {
  const car = g.player.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  const sx = Math.cos(car.heading);
  const sz = -Math.sin(car.heading);
  g.player.x = car.x + sx * 2.4;
  g.player.z = car.z + sz * 2.4;
  g.player.y = 0;
  g.player.vy = 0;
  g.player.car = null;
  g.player.mesh.visible = true;
  g.player.mesh.position.set(g.player.x, 0, g.player.z);
  g.audio.setEngine(0, false);
}
