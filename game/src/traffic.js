// Traffic: cars that drive the street grid like locals — along a street, turning at
// intersections at random, slowing for the car ahead, and respawning far away if the
// player shoves them off the road. Each car owns a lane (right-hand traffic) and a
// speed; nothing here pathfinds, the grid is the path.
import { CITY_HALF, GRID, PITCH, STREET } from './config.js';
import { collideCar, makeCar } from './vehicles.js';
import { nearestStreet } from './city.js';

const TRAFFIC_COUNT = 10;

function randomRoute(rng) {
  const alongX = rng.chance(0.5);
  const line = rng.pick([-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => k * PITCH));
  const along = rng.range(-CITY_HALF + 20, CITY_HALF - 20);
  const dir = rng.chance(0.5) ? 1 : -1;
  // Right-hand lane: +3.2 m on the right of the direction of travel.
  const lane = 3.2;
  return { alongX, line, along, dir, lane };
}

export function spawnTraffic(g) {
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const r = randomRoute(g.rng);
    const x = r.alongX ? r.along : r.line + (r.dir > 0 ? r.lane : -r.lane);
    const z = r.alongX ? r.line + (r.dir > 0 ? -r.lane : r.lane) : r.along;
    const heading = r.alongX ? (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (r.dir > 0 ? 0 : Math.PI);
    const car = makeCar(g, x, z, heading, g.rng.pick([0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x22262b, 0x7a4fb5]), 'traffic');
    car.route = r;
    car.speed = g.rng.range(6, 10);
    car.cruise = car.speed;
  }
}

/** Is another car ahead of `car` on the same street and lane? */
function carAhead(g, car) {
  let nearest = Infinity;
  for (const other of g.cars) {
    if (other === car || other.kind === 'player') continue;
    if (other.kind === 'police' && other.disabled) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    // Forward is (sin heading, cos heading); along is how far ahead, side how far off.
    const along = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
    if (along > 0 && along < nearest && side < 3) nearest = along;
  }
  return nearest;
}

export function updateTraffic(g, dt) {
  for (const car of g.cars) {
    if (car.kind !== 'traffic' || car.disabled) continue;
    const r = car.route;
    // Slow for the car ahead.
    const ahead = carAhead(g, car);
    const target = ahead < 12 ? Math.max(0, (ahead - 6) * 0.8) : car.cruise;
    car.speed += Math.max(-8 * dt, Math.min(4 * dt, target - car.speed));
    // Advance along the street.
    const step = car.speed * r.dir * dt;
    if (r.alongX) car.x += step;
    else car.z += step;
    // At an intersection, maybe turn onto the cross street. Through-traffic
    // (noTurn) stays on its street.
    const cross = nearestStreet(r.alongX ? car.x : car.z);
    const atIntersection = Math.abs((r.alongX ? car.x : car.z) - cross) < 1.2 && Math.abs(cross) <= GRID * PITCH;
    if (atIntersection && !car.turnedAt && !car.noTurn) {
      car.turnedAt = cross;
      if (g.rng.chance(0.4)) {
        const newDir = g.rng.chance(0.5) ? 1 : -1;
        const newLane = 3.2;
        if (r.alongX) {
          car.route = { alongX: false, line: cross, along: car.z, dir: newDir, lane: newLane };
          car.x = cross + (newDir > 0 ? newLane : -newLane);
          car.heading = newDir > 0 ? 0 : Math.PI;
        } else {
          car.route = { alongX: true, line: cross, along: car.x, dir: newDir, lane: newLane };
          car.z = cross + (newDir > 0 ? -newLane : newLane);
          car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    } else if (!atIntersection) {
      car.turnedAt = null;
    }
    // Off the map or shoved away: respawn on a far street.
    if (Math.abs(car.x) > CITY_HALF + 40 || Math.abs(car.z) > CITY_HALF + 40) {
      const nr = randomRoute(g.rng);
      car.route = nr;
      car.x = nr.alongX ? nr.along : nr.line;
      car.z = nr.alongX ? nr.line : nr.along;
      car.speed = car.cruise;
    }
    collideCar(g, car, 1.7);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}
