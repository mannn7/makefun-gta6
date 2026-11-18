// The world: one state object that every system reads and writes, the fixed-step
// update that runs them in order, the third-person camera, and save/load. The
// renderer and the screens live in main.js; this file only knows the simulation.
import * as THREE from 'three';
import { CITY_HALF, CLOCK_RATE, CLOCK_START_MINUTES, PALETTE, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createPlayerMesh, updatePlayerOnFoot } from './player.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions, updateMissions } from './missions.js';
import { enterCar, exitCar, nearestCar, spawnParkedCars, updatePlayerCar } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { spawnPickups, updateCombat } from './combat.js';
import { updateHud } from './hud.js';
import { drawMinimap } from './minimap.js';

export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;

/** Build a fresh game: scene, lights, city, cars, people, missions, HUD hooks. */
export function createGame(seed) {
  const rng = createRandom(seed);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 720);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.9));

  const g = {
    seed,
    rng,
    scene,
    time: 0,
    clockMinutes: CLOCK_START_MINUTES,
    cash: 0,
    wanted: 0,
    shotNoise: 0,
    screen: 'title',
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    cameraPos: new THREE.Vector3(0, 8, 12),
    cameraLook: new THREE.Vector3(0, 1.5, 0),
    cars: [],
    peds: [],
    pickups: [],
    city: null,
    player: null,
    police: null,
    missions: null,
    hud: null,
    audio: null,
    minimapCanvas: null,
    camera: null,
    muzzle: null,
    muzzleLight: null,
    muzzleTimer: 0,
    wasted() {},
    busted() {},
    save() {},
    loadSave() {
      return null;
    },
  };

  g.city = buildCity(scene, rng);
  g.player = {
    mesh: createPlayerMesh(),
    x: 0,
    y: 0,
    z: 20,
    vy: 0,
    heading: 0,
    walkPhase: 0,
    moving: false,
    health: 100,
    ammo: 24,
    armed: false,
    punchCooldown: 0,
    car: null,
  };
  scene.add(g.player.mesh);
  g.player.mesh.position.set(0, 0, 20);

  // Muzzle flash: a sprite and a point light at the gun, hidden until fired.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, depthWrite: false }),
  );
  flash.visible = false;
  const flashLight = new THREE.PointLight(0xffd98a, 0, 12);
  scene.add(flash);
  scene.add(flashLight);
  g.muzzle = flash;
  g.muzzleLight = flashLight;

  g.audio = createAudio();
  g.hud = createHud();
  g.police = createPolice(g);
  g.missions = createMissions(g);
  spawnParkedCars(g);
  spawnTraffic(g);
  spawnPedestrians(g);
  spawnPickups(g);
  return g;
}

/** Put the game back to a fresh run, keeping the seed so shots repeat. */
export function resetGame(g) {
  // Remove the dynamic meshes, then rebuild the world in place.
  for (const car of g.cars) g.scene.remove(car.mesh);
  for (const ped of g.peds) g.scene.remove(ped.mesh);
  for (const pk of g.pickups) g.scene.remove(pk.mesh);
  g.cars = [];
  g.peds = [];
  g.pickups = [];
  g.rng = createRandom(g.seed);
  g.time = 0;
  g.clockMinutes = CLOCK_START_MINUTES;
  g.cash = 0;
  g.wanted = 0;
  g.shotNoise = 0;
  g.cameraYaw = Math.PI;
  g.cameraPitch = 0.32;
  const p = g.player;
  p.x = 0;
  p.y = 0;
  p.z = 20;
  p.vy = 0;
  p.heading = 0;
  p.health = 100;
  p.ammo = 24;
  p.armed = false;
  p.car = null;
  p.mesh.visible = true;
  p.mesh.position.set(0, 0, 20);
  g.police.cars = [];
  g.police.unseenTimer = 0;
  g.police.decayTimer = 0;
  g.police.bustedTimer = 0;
  g.missions.index = 0;
  g.missions.stage = 0;
  g.missions.active = false;
  g.missions.collected = 0;
  g.missions.beacon.visible = false;
  g.missions.target = null;
  spawnParkedCars(g);
  spawnTraffic(g);
  spawnPedestrians(g);
  spawnPickups(g);
}

/** One fixed step of the whole simulation. */
export function updateGame(g, dt, input) {
  g.time += dt;
  g.clockMinutes += CLOCK_RATE * dt;
  const p = g.player;
  // Enter or exit a car.
  if (input.pressed('KeyE')) {
    if (p.car) exitCar(g);
    else {
      const car = nearestCar(g, p.x, p.z, 4);
      if (car) enterCar(g, car);
    }
  }
  if (p.car) updatePlayerCar(g, dt, input);
  else updatePlayerOnFoot(g, dt, input);
  updateTraffic(g, dt);
  updatePedestrians(g, dt);
  updatePolice(g, dt);
  updateCombat(g, dt, input);
  updateMissions(g, dt);
  updateCamera(g, dt, input);
  updateHud(g, dt);
  drawMinimap(g);
}

/** Third-person orbit on foot, chase camera in a car. */
export function updateCamera(g, dt, input) {
  const mouse = input.takeMouse();
  g.cameraYaw -= mouse.dx * 0.0032;
  g.cameraPitch = Math.max(-0.1, Math.min(0.9, g.cameraPitch + mouse.dy * 0.0024));
  const p = g.player;
  let targetPos;
  let look;
  if (p.car) {
    const car = p.car;
    const back = 9.5 + Math.abs(car.speed) * 0.12;
    const height = 3.6 + Math.abs(car.speed) * 0.03;
    targetPos = new THREE.Vector3(
      car.x - Math.sin(car.heading) * back,
      height,
      car.z - Math.cos(car.heading) * back,
    );
    look = new THREE.Vector3(car.x + Math.sin(car.heading) * 6, 1.4, car.z + Math.cos(car.heading) * 6);
  } else {
    // Closer, lower third-person camera: Marco fills more of the frame and the
    // street ahead reads instead of the ground at his feet.
    const dist = 6;
    const height = 1.8 + Math.sin(g.cameraPitch) * dist;
    targetPos = new THREE.Vector3(
      p.x + Math.sin(g.cameraYaw) * Math.cos(g.cameraPitch) * dist,
      p.y + height,
      p.z + Math.cos(g.cameraYaw) * Math.cos(g.cameraPitch) * dist,
    );
    look = new THREE.Vector3(p.x, p.y + 1.6, p.z);
  }
  // Smooth the camera so it glides instead of snapping.
  const k = Math.min(1, dt * 7);
  g.cameraPos.lerp(targetPos, k);
  g.cameraLook.lerp(look, k);
  if (g.camera) {
    g.camera.position.copy(g.cameraPos);
    g.camera.lookAt(g.cameraLook);
    // The muzzle flash rides in front of the camera when armed.
    if (g.muzzle && p.armed) {
      const dir = new THREE.Vector3();
      g.camera.getWorldDirection(dir);
      g.muzzle.position.copy(g.camera.position).addScaledVector(dir, 1.2);
      g.muzzle.position.y -= 0.12;
      g.muzzle.quaternion.copy(g.camera.quaternion);
    }
  }
}

/** Save cash and mission progress to this browser. */
export function saveGame(g) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ cash: g.cash, missionsDone: g.missions.index, time: g.time }),
    );
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

/** Load a save, or null when there is none. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
