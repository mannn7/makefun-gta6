// V2 (restage) + R6 (density pass): all four scenes now play at dusk against the
// pastel + neon beach strip — the chase at dusk with neon behind, the drive down
// the beach strip, the on-foot walk past the lifeguard tower and hotels, and the
// mission beacon at sunset. R6 stages DENSITY into the frame: the chase camera
// is low and close (the red coupe big, cruisers flanking its tail), oncoming
// traffic ahead for depth, pedestrians on the sidewalks, and every scene runs a
// real job so the HUD arrow, pink minimap route and objective all read.
// R7: the steal's stale feed lines are dropped in putInCar (they claimed a
// wanted level the HUD no longer showed), and the mission scene ends on a real
// combat moment — Marco on foot, pistol drawn, firing at a cruiser blocking the
// road to the cash drop, the beacon still glowing ahead.
// Screenshot scenes: each one plays the REAL game forward from a fresh world with
// a fixed seed and a simple autopilot (waypoint driving, sidewalk walking), so the
// frame is what a short game really looks like and the same seed always gives the
// same frame. The four scenes are the four screenshots; ?shot=play is the drive
// scene, and anything unknown falls back to it.
import * as THREE from 'three';
import { GRID, PITCH, STEP } from './config.js';
import { resetGame, updateGame } from './world.js';
import { enterCar, exitCar, makeCar, nearestCar } from './vehicles.js';
import { shoot } from './combat.js';
import { spawnPedAt } from './pedestrians.js';
import { updateHud } from './hud.js';
import { drawMinimap } from './minimap.js';

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
  // The steal prints "Car theft — wanted level 1." and "You stole a car!"
  // into the feed, but a staged scene then resets the heat to zero — those
  // lines would linger, claiming a wanted level the HUD no longer shows.
  // Drop exactly the lines this steal added (none, if the car was traffic)
  // and nothing else: a mission brief printed before or after stays put.
  const feedBefore = new Set([...g.hud.feedBox.children]);
  enterCar(g, car);
  // A stolen car in a staged scene should not add heat unless the scene wants it.
  if (g.wanted > 0) {
    g.wanted = 0;
    g.hud.setWanted(0);
  }
  for (const line of [...g.hud.feedBox.children]) {
    if (!feedBefore.has(line)) line.remove();
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

/** Stage a car for the final frame (no more simulation runs after this, so it
 * needs no route — it just has to sit in the frame, positioned and facing). */
function stageCar(g, x, z, heading, color, kind, speed) {
  const car = makeCar(g, x, z, heading, color, kind);
  car.speed = speed || 0;
  car.cruise = speed || 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  return car;
}

/** Refresh the HUD + minimap after staging, so they match the final frame
 * (the compass, the arrow distance, the police dots) instead of the last
 * simulation step. */
function refreshHud(g) {
  updateHud(g, STEP);
  drawMinimap(g);
}

const SCENES = {
  // COVER: a police chase — wanted 4 (red stars), two cruisers flanking the
  // player's tail, the safehouse marker ahead, the player flooring it down
  // Marina Row. The camera is low and close now, so the red coupe fills the
  // frame instead of shrinking to a dot.
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
    const playerCar = g.player.car;
    // Heat up to four stars for the frame: red stars + car/face evidence in
    // the HUD. (No feed line: the reason is empty on purpose.)
    g.police.addWanted(1, '');
    // Stage the cruisers for the frame: right on the player's tail, just
    // behind and to the sides, so they flank the red coupe in the centre of
    // the frame instead of looming over the HUD corners. (An earlier pass put
    // them 5-8 m from the camera and they blocked the minimap and the feed.)
    g.police.cars.forEach((cop, i) => {
      const off = i === 0 ? [-3, -6] : [3, -9];
      cop.x = playerCar.x + off[0];
      cop.z = playerCar.z + off[1];
      cop.heading = playerCar.heading;
      cop.speed = playerCar.speed;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    });
    // Oncoming traffic ahead, for depth: cars in the far lane coming toward
    // the chase, far enough ahead that they read as traffic, not a collision.
    for (const dz of [35, 60, 85]) {
      stageCar(g, -3.2, playerCar.z + dz, Math.PI, g.rng.pick([0x2e6fc2, 0xe8c832, 0xe8e8e8]), 'traffic', 8);
    }
    // Pedestrians on the sidewalks beside the chase, scattering from the noise.
    spawnPedAt(g, 9.5, playerCar.z + 8, Math.PI, 0xd94f30);
    spawnPedAt(g, -9.5, playerCar.z + 18, 0, 0x3aa655);
    spawnPedAt(g, 9.5, playerCar.z + 32, Math.PI / 2, 0xe8c832);
    // Cinematic camera: low and close behind the player's car, the cruisers
    // flanking its tail in the centre of the frame, the road and the dusk
    // city ahead.
    g.camera.position.set(playerCar.x + 1, 5, playerCar.z - 20);
    g.camera.lookAt(playerCar.x, 1.3, playerCar.z + 10);
    g.cameraPos.copy(g.camera.position);
    g.cameraLook.set(playerCar.x, 1.3, playerCar.z + 10);
    refreshHud(g);
  },
  // Driving down the beach strip at dusk: pastel hotels and neon on the left,
  // palms, sand and the turquoise sea on the right. Marco drives in the
  // eastbound lane; three oncoming cars in the westbound lane pass him (6.4 m
  // apart, no sideswipe) so the street reads as alive. This is a delivery run
  // (M1, second stage), so the HUD arrow, the pink minimap route and the
  // objective all show.
  drive(g, input) {
    putInCar(g, -180, 228.8, Math.PI / 2, 0x2e6fc2);
    clearRoute(g, true, 232, -180, 180);
    g.missions.start(0);
    g.missions.stage = 1;
    g.missions.placeBeacon();
    g.hud.setObjective('Deliver the package to the Sunset Motel');
    for (const x of [30, 60, 90, 120, 150, 180]) {
      const car = makeCar(g, x, 235.2, -Math.PI / 2, g.rng.pick([0xc23b2e, 0xe8c832, 0x3aa655, 0xe8e8e8]), 'traffic');
      car.route = { alongX: true, line: 232, along: x, dir: -1, lane: 235.2 };
      car.speed = 8;
      car.cruise = 8;
      car.noTurn = true;
    }
    const route = [{ x: 180, z: 228.8 }];
    playForward(g, input, 10, () => drivePilot(g, route));
    const car = g.player.car;
    // Traffic ahead in the frame: oncoming cars in the far lane and one car
    // ahead in the player's own lane, so the road ahead is never empty.
    stageCar(g, car.x + 45, 235.2, -Math.PI / 2, 0xe8c832, 'traffic', 8);
    stageCar(g, car.x + 80, 235.2, -Math.PI / 2, 0xc23b2e, 'traffic', 8);
    stageCar(g, car.x + 55, 228.8, Math.PI / 2, 0x3aa655, 'traffic', 10);
    // Pedestrians on the hotel sidewalk, on the left of the frame.
    for (const [dx, shirt] of [[5, 0xd94f30], [20, 0x3a7bd5], [35, 0x3aa655], [50, 0xe8c832]]) {
      spawnPedAt(g, car.x + dx, 222, g.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, shirt);
    }
    refreshHud(g);
  },
  // On foot on the beachfront strip: Marco walking east along the Ocean Drive
  // sidewalk at dusk, the pastel hotel strip with neon on his left, palms and
  // the sand and sea on his right, a lifeguard tower down the beach. The
  // camera looks east-north-east so the strip fills the frame instead of
  // empty sand. This is the delivery walk (M1, second stage), so the HUD
  // arrow and the pink minimap route give the walk a destination.
  // The road is cleared of parked cars first, so Marco never clips through one.
  street(g, input) {
    g.player.x = -70;
    g.player.z = 222;
    g.player.heading = Math.PI / 2;
    g.cameraYaw = -1.5;
    clearRoute(g, true, 232, -80, 40);
    g.missions.start(0);
    g.missions.stage = 1;
    g.missions.placeBeacon();
    g.hud.setObjective('Deliver the package to the Sunset Motel');
    const route = [{ x: 20, z: 222 }];
    playForward(g, input, 4, () => walkPilot(g, route));
    const p = g.player;
    // Pedestrians sharing the sidewalk with Marco, ahead of him in the frame.
    for (const [dx, dz, heading, shirt] of [
      [8, -1, Math.PI / 2, 0xd94f30],
      [18, 1, -Math.PI / 2, 0x3a7bd5],
      [28, -1, Math.PI / 2, 0x3aa655],
      [40, 0, -Math.PI / 2, 0xe8c832],
      [52, 1, Math.PI / 2, 0x7a4fb5],
    ]) {
      spawnPedAt(g, p.x + dx, 222 + dz, heading, shirt);
    }
    // A parked car and a passing car on the road, on the right of the frame.
    stageCar(g, p.x + 30, 235.2, -Math.PI / 2, 0x2e6fc2, 'parked', 0);
    stageCar(g, p.x + 55, 228.8, Math.PI / 2, 0xe8c832, 'traffic', 9);
    refreshHud(g);
  },
  // A mission in progress, ending on combat: the M3 cash-drop beacon ahead,
  // Marco drives to it — then steps out, draws the pistol and fires at a
  // cruiser blocking the road to the drop. The beacon, the HUD arrow and the
  // objective stay readable; the crosshair, the pistol icon, the ammo count
  // and the frozen muzzle flash are what make the combat real in the frame.
  mission(g, input) {
    g.missions.start(2);
    putInCar(g, -116, -20, 0, 0xe8c832);
    clearRoute(g, false, -116, -20, 116);
    const route = [{ x: -116, z: 60 }];
    playForward(g, input, 5.5, () => drivePilot(g, route));
    const car = g.player.car;
    // Combat moment: Marco steps out beside the gold coupe, pistol drawn,
    // facing north toward the beacon. The camera settles behind him on foot
    // (a short no-op run — no driving after this point).
    exitCar(g);
    const p = g.player;
    p.heading = 0;
    p.armed = true;
    p.ammo = 24;
    g.hud.setArmed(true);
    g.cameraYaw = Math.PI;
    playForward(g, input, 0.5, () => ({ x: 0, y: 0 }));
    // A cruiser blocking the road between Marco and the beacon, facing him.
    // Staged after the last simulation step, so it never moves: updateTraffic
    // only drives 'traffic' cars, and it is not in the police chase list.
    const cruiser = makeCar(g, p.x, p.z + 14, Math.PI, 0x1d3fae, 'police');
    cruiser.speed = 0;
    // Oncoming traffic in the far lane, past the beacon, for depth down the road.
    for (const dz of [45, 70, 95]) {
      stageCar(g, -119.2, car.z + dz, Math.PI, g.rng.pick([0x2e6fc2, 0xc23b2e, 0xe8e8e8]), 'traffic', 8);
    }
    // Pedestrians on the sidewalks flanking the street, near the drop — kept
    // off the firing line (the shot runs straight north from Marco).
    spawnPedAt(g, -106.5, car.z + 12, 0, 0xd94f30);
    spawnPedAt(g, -125.5, car.z + 25, Math.PI, 0x3aa655);
    spawnPedAt(g, -106.5, car.z + 38, Math.PI / 2, 0xe8c832);
    // Fire: the muzzle flash and its light freeze in the frame (no updateGame
    // runs after staging). The shot misses the cruiser — the camera ray drops
    // below it — so it adds no heat and no feed line, and the mission brief
    // stays clean.
    shoot(g);
    // The flash rides 1.2 m in front of the camera by default, a huge yellow
    // square at that range — and dead ahead of Marco it hides behind his body.
    // Move it to his right hand, just ahead of his shoulder, facing the
    // camera, and take its light with it; make it a touch bigger so it reads.
    const gunX = p.x + Math.cos(p.heading) * 0.9 + Math.sin(p.heading) * 0.6;
    const gunZ = p.z - Math.sin(p.heading) * 0.9 + Math.cos(p.heading) * 0.6;
    g.muzzle.position.set(gunX, 1.3, gunZ);
    g.muzzle.scale.set(1.5, 1.5, 1);
    g.muzzle.quaternion.copy(g.camera.quaternion);
    g.muzzleLight.position.copy(g.muzzle.position);
    refreshHud(g);
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
