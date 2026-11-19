// V2 (dusk pass): a gradient sky dome (orange horizon → pink → purple → deep
// blue) plus a glowing sun disc low over the sea replace the flat sky, and the
// sun is a low warm golden-hour light with long shadows. Stamina and focus now
// feed the GTA 6 top-left meters.
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

/** A dusk sky dome: a canvas gradient (orange horizon → pink → purple → deep
 * blue top) on the inside of a big sphere, so the sky reads as golden hour from
 * every angle instead of one flat colour. */
function createSkyDome() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#23235e'); // zenith: deep dusk blue
  grad.addColorStop(0.38, '#6b4a9e'); // purple
  grad.addColorStop(0.52, '#e85d9e'); // pink band
  grad.addColorStop(0.62, '#ff9a3d'); // orange horizon glow
  grad.addColorStop(0.72, '#ffc46b'); // low sun haze
  grad.addColorStop(1.0, '#7a4a5e'); // below the horizon
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(950, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  return dome;
}

/** A soft glowing disc where the sun sits low over the sea. */
function createSunDisc() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.25, 'rgba(255,190,100,0.9)');
  grad.addColorStop(0.6, 'rgba(255,120,60,0.35)');
  grad.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  // Low over the sea to the south-west, where the camera looks in the shots.
  disc.position.set(-260, 70, 620);
  disc.lookAt(0, 40, 0);
  return disc;
}

/** Build a fresh game: scene, lights, city, cars, people, missions, HUD hooks. */
export function createGame(seed) {
  const rng = createRandom(seed);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.add(createSkyDome());
  scene.add(createSunDisc());
  scene.fog = new THREE.Fog(PALETTE.fog, 200, 650);

  // Golden hour: the sun sits low and warm, so shadows stretch long and the
  // whole city glows orange-pink instead of glaring white.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.5);
  sun.position.set(280, 80, 140);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.05));

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
    stamina: 100,
    focus: 0,
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
  p.stamina = 100;
  p.focus = 0;
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
  // Stamina drains while sprinting on foot and recovers otherwise; focus builds
  // while the pistol is out and fades when it is holstered.
  const sprinting = !p.car && p.moving && (input.held('ShiftLeft') || input.held('ShiftRight'));
  p.stamina = sprinting
    ? Math.max(0, p.stamina - 22 * dt)
    : Math.min(100, p.stamina + 16 * dt);
  p.focus = p.armed ? Math.min(100, p.focus + 10 * dt) : Math.max(0, p.focus - 6 * dt);
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
