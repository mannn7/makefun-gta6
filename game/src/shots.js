// V2 (restage): all four scenes now play at dusk against the pastel + neon
// beach strip — the chase at dusk with neon behind, the drive down the beach
// strip, the on-foot walk past the lifeguard tower and hotels, and the mission
// beacon at sunset. The street scene walks north-east so the frame holds the
// beach-strip buildings and a lifeguard tower, not just empty sand.
// Screenshot scenes: each one plays the REAL game forward from a fresh world with
// a fixed seed and a simple autopilot (waypoint driving, sidewalk walking), so the
// frame is what a short game really looks like and the same seed always gives the
// same frame. The four scenes are the four screenshots; ?shot=play is the drive
// scene, and anything unknown falls back to it.
import * as THREE from 'three';
import { GRID, PITCH, STEP } from './config.js';
import { resetGame, updateGame } from './world.js';
import { enterCar, makeCar, nearestCar } from './vehicles.js';

/** A synthetic input that answers like the real one, steered by the autopilot. */
function pilotInput() {
  let axis = { x: 0, y: 0 };
  return {
    setAxis(next) {
      axis = next;
    },
    held() {
      return false;
    },
    pressed() {
      return false;
    },
    moveAxis() {
      return axis;
    },
    takeMouse() {
      return { dx: 0, dy: 0 };
    },
    takeActions() {
      return 0;
    },
    endFrame() {},
  };
}

/** Steer a car toward the next waypoint; returns a move axis for updatePlayerCar. */
function drivePilot(g, waypoints) {
  const car = g.player.car;
  if (!car || waypoints.length === 0) return { x: 0, y: 0 };
  const wp = waypoints[0];
  const dx = wp.x - car.x;
  const dz = wp.z - car.z;
  if (Math.hypot(dx, dz) < 7) {
    waypoints.shift();
    return { x: 0, y: 0 };
  }
  // Stuck against a wall (throttle on, barely moving): reverse out with a turn.
  const state = drivePilot.state;
  if (Math.abs(car.speed) < 1.5) {
    state.stuck += STEP;
  } else {
    state.stuck = 0;
  }
  if (state.stuck > 0.8) {
    if (state.stuck > 1.6) state.stuck = 0;
    return { x: 0.9, y: -1 };
  }
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Off the street line (shoved sideways by a crossing car): aim back at the
  // line 15 m ahead first, so the car returns to the road instead of grinding
  // along the building it was pushed into.
  const legEastWest = Math.abs(wp.x - car.x) > Math.abs(wp.z - car.z);
  let steerTarget = targetHeading;
  if (legEastWest && Math.abs(car.z - wp.z) > 3) {
    steerTarget = Math.atan2(car.x + Math.sign(wp.x - car.x) * 15 - car.x, wp.z - car.z);
  } else if (!legEastWest && Math.abs(car.x - wp.x) > 3) {
    steerTarget = Math.atan2(wp.x - car.x, car.z + Math.sign(wp.z - car.z) * 15 - car.z);
  }
  diff = steerTarget - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8));
  // D turns the car right, which decreases heading: axis.x is -steer.
  return { x: -steer, y: Math.abs(diff) > 1.1 ? 0 : 1 };
}
drivePilot.state = { stuck: 0 };

/** Walk toward the next waypoint; returns a camera-relative move axis. */
function walkPilot(g, waypoints) {
  const p = g.player;
  if (waypoints.length === 0) return { x: 0, y: 0 };
  const wp = waypoints[0];
  const dx = wp.x - p.x;
  const dz = wp.z - p.z;
  if (Math.hypot(dx, dz) < 3) {
    waypoints.shift();
    return { x: 0, y: 0 };
  }
  const len = Math.hypot(dx, dz);
  const wx = dx / len;
  const wz = dz / len;
  const fx = -Math.sin(g.cameraYaw);
  const fz = -Math.cos(g.cameraYaw);
  const rx = -fz;
  const rz = fx;
  return { x: wx * rx + wz * rz, y: wx * fx + wz * fz };
}

/** Step the world forward `seconds` with the autopilot driving. */
function playForward(g, input, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  const trace = [];
  for (let i = 0; i < steps; i += 1) {
    input.setAxis(pilot());
    updateGame(g, STEP, input);
    if (i % 30 === 0 && g.player.car) {
      const c = g.player.car;
      trace.push([+(i * STEP).toFixed(1), +c.x.toFixed(0), +c.z.toFixed(0), +c.heading.toFixed(2), +c.speed.toFixed(1)]);
    }
  }
  window.__trace = trace;
  window.__traffic = g.cars.filter((c) => c.kind === 'traffic').map((c) => [Math.round(c.x), Math.round(c.z), +c.heading.toFixed(2)]);
}

/** Put the player in a car at a known spot, spawning one if none is parked there. */
function putInCar(g, x, z, heading, color) {
  let car = nearestCar(g, x, z, 8);
  if (!car) {
    car = makeCar(g, x, z, heading, color, 'parked');
  }
  g.player.x = car.x;
  g.player.z = car.z;
  enterCar(g, car);
  // A stolen car in a staged scene should not add heat unless the scene wants it.
  if (g.wanted > 0) {
    g.wanted = 0;
    g.hud.setWanted(0);
  }
}

/** Clear other cars off a street segment so the staged car has a clean run. */
function clearRoute(g, alongX, line, from, to) {
  for (let i = g.cars.length - 1; i >= 0; i -= 1) {
    const car = g.cars[i];
    if (car.kind === 'player' || car.kind === 'police') continue;
    const onLine = alongX ? Math.abs(car.z - line) < 8 : Math.abs(car.x - line) < 8;
    const along = alongX ? car.x : car.z;
    if (onLine && along > from && along < to) {
      g.scene.remove(car.mesh);
      g.cars.splice(i, 1);
    }
  }
}

const SCENES = {
  // COVER: a police chase — wanted 3, two cruisers closing in, the safehouse
  // marker ahead, the player flooring it down Marina Row.
  chase(g, input) {
    putInCar(g, 0, -180, 0, 0xc23b2e);
    clearRoute(g, false, 0, -180, 180);
    g.police.addWanted(3, '');
    g.missions.start(1);
    // M2's first stage is the steal; skip to the escape stage.
    g.missions.stage = 1;
    g.missions.placeBeacon();
    g.hud.setObjective('Escape to the safehouse — lose the cops');
    // Two cruisers already on the player's tail, right behind him on the same
    // street so they chase instead of pinning him from the sides.
    const car = g.player.car;
    for (const [dx, dz] of [[-4, -14], [4, -22]]) {
      const cop = makeCar(g, car.x + dx, car.z + dz, 0, 0x1d3fae, 'police');
      cop.speed = 26;
      cop.cruise = 28;
      g.police.cars.push(cop);
    }
    // One route array, shared by every pilot call: drivePilot shifts waypoints
    // off it as they are reached, and a fresh array each call would forget.
    const route = [{ x: 0, z: 60 }, { x: 0, z: 180 }];
    playForward(g, input, 9, () => drivePilot(g, route));
    // Stage the cruisers for the frame: both right behind the red coupe, where
    // a chase puts them. They chased for real for nine seconds; this places
    // them where the camera can see them.
    const playerCar = g.player.car;
    g.police.cars.forEach((cop, i) => {
      const off = i === 0 ? [-5, -12] : [5, -18];
      cop.x = playerCar.x + off[0];
      cop.z = playerCar.z + off[1];
      cop.heading = playerCar.heading;
      cop.speed = playerCar.speed;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    });
    // Cinematic camera: high behind the cruisers, looking forward over them at
    // the player's car with the road ahead — the chase reads as a line of cars.
    g.camera.position.set(playerCar.x + 4, 12, playerCar.z - 44);
    g.camera.lookAt(playerCar.x, 1, playerCar.z + 6);
    g.cameraPos.copy(g.camera.position);
  },
  // Driving down the beach strip at dusk: pastel hotels and neon on the left,
  // palms, sand and the turquoise sea on the right. Marco drives in the
  // eastbound lane; three oncoming cars in the westbound lane pass him (6.4 m
  // apart, no sideswipe) so the street reads as alive.
  drive(g, input) {
    putInCar(g, -180, 228.8, Math.PI / 2, 0x2e6fc2);
    clearRoute(g, true, 232, -180, 180);
    for (const x of [90, 120, 150, 180]) {
      const car = makeCar(g, x, 235.2, -Math.PI / 2, g.rng.pick([0xc23b2e, 0xe8c832, 0x3aa655, 0xe8e8e8]), 'traffic');
      car.route = { alongX: true, line: 232, along: x, dir: -1, lane: 235.2 };
      car.speed = 8;
      car.cruise = 8;
      car.noTurn = true;
    }
    const route = [{ x: 180, z: 228.8 }];
    playForward(g, input, 10, () => drivePilot(g, route));
  },
  // On foot on the beachfront strip: Marco walking east along the Ocean Drive
  // road at dusk, the pastel hotel strip with neon on his left, palms and the
  // sand and sea on his right, a lifeguard tower down the beach. The camera
  // looks east-north-east so the strip fills the frame instead of empty sand.
  // The road is cleared of parked cars first, so Marco never clips through one.
  street(g, input) {
    g.player.x = -70;
    g.player.z = 231;
    g.player.heading = Math.PI / 2;
    g.cameraYaw = -1.5;
    clearRoute(g, true, 232, -80, 40);
    const route = [{ x: 20, z: 229 }];
    playForward(g, input, 4, () => walkPilot(g, route));
  },
  // A mission in progress: the M3 cash-drop beacon ahead, Marco driving to it.
  mission(g, input) {
    g.missions.start(2);
    putInCar(g, -116, -20, 0, 0xe8c832);
    clearRoute(g, false, -116, -20, 116);
    const route = [{ x: -116, z: 60 }];
    playForward(g, input, 5.5, () => drivePilot(g, route));
  },
};

/**
 * Stage the named scene (chase, drive, street, mission; play is drive, anything
 * else is drive) and return the screen to show. The caller renders once.
 */
export function stageShot(name, g) {
  resetGame(g);
  g.screen = 'play';
  g.hud.showScreen('play');
  const input = pilotInput();
  const scene = SCENES[name] || SCENES.drive;
  scene(g, input);
  return { screen: 'play' };
}
