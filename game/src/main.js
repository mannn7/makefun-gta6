// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, wasted and busted.
//
// ?seed=N fixes the city. ?shot=chase|drive|street|mission (with &seed=N) stages
// that scene instead of running the loop, paints it once and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { STEP } from './config.js';
import { createGame, loadSave, resetGame, saveGame, updateGame } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './hud.js';
import { stageShot } from './shots.js';

/** Any uncaught error renames the page, so a headless check can see it. */
window.addEventListener('error', (event) => {
  document.title = `GAME_ERROR: ${event.message}`;
});

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const g = createGame(seed);
g.minimapCanvas = document.getElementById('minimap');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1500);
g.camera = camera;
g.cameraPos.set(0, 10, 30);
g.cameraLook.set(0, 1.5, 0);

let lastW = window.innerWidth;
let lastH = window.innerHeight;
window.addEventListener('resize', () => {
  // Setting the canvas size clears its drawing buffer, so only resize when the
  // window really changed size — a redundant resize after a screenshot render
  // would blank the frame.
  if (window.innerWidth === lastW && window.innerHeight === lastH) return;
  lastW = window.innerWidth;
  lastH = window.innerHeight;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function announce(message) {
  status.textContent = message;
}

g.wasted = () => {
  if (g.screen !== SCREEN_PLAY) return;
  g.screen = SCREEN_WASTED;
  g.hud.showScreen(SCREEN_WASTED);
  g.audio.fail();
  saveGame(g);
  announce('Wasted. The city got the better of Marco.');
};
g.busted = () => {
  if (g.screen !== SCREEN_PLAY) return;
  g.screen = SCREEN_BUSTED;
  g.hud.showScreen(SCREEN_BUSTED);
  g.audio.fail();
  saveGame(g);
  announce('Busted. The Solara Bay police took Marco in.');
};
g.save = () => saveGame(g);

function startGame(fromSave) {
  resetGame(g);
  if (fromSave) {
    g.cash = fromSave.cash || 0;
    g.missions.index = Math.min(fromSave.missionsDone || 0, 4);
    g.hud.feed(`Welcome back. Cash $${g.cash}. ${4 - g.missions.index} jobs left with Rosa.`);
  } else {
    g.hud.feed('Solara Bay. Rosa is waiting — press J to start your first job.');
  }
  g.screen = SCREEN_PLAY;
  g.hud.showScreen(SCREEN_PLAY);
  g.hud.setObjective(g.missions.objectiveText());
  g.hud.setWanted(0);
  g.audio.ensure();
  g.audio.startAmbient();
  announce('Playing. Solara Bay is open.');
}

function runShot(name) {
  stageShot(name, g);
  // Render on the next animation frame, after any start-up resize has settled:
  // resizing the canvas clears its drawing buffer, so a render done before the
  // window reaches its final size is blanked by the resize that follows it.
  requestAnimationFrame(() => {
    renderer.render(g.scene, g.camera);
    window.__shotReady = true;
  });
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  const save = loadSave();
  g.screen = SCREEN_TITLE;
  g.hud.showScreen(SCREEN_TITLE);
  if (save && (save.cash > 0 || save.missionsDone > 0)) {
    g.hud.continueBtn.classList.remove('hidden');
    g.hud.continueBtn.textContent = `Continue — $${save.cash} · ${save.missionsDone}/4 jobs done`;
  }

  g.hud.startBtn.addEventListener('click', () => startGame(null));
  g.hud.continueBtn.addEventListener('click', () => startGame(loadSave()));
  g.hud.resumeBtn.addEventListener('click', () => {
    g.screen = SCREEN_PLAY;
    g.hud.showScreen(SCREEN_PLAY);
  });
  g.hud.restartBtn.addEventListener('click', () => startGame(null));
  g.hud.restartBtn2.addEventListener('click', () => startGame(null));
  g.hud.missionBtn.addEventListener('click', () => startNextMission());

  function startNextMission() {
    if (g.screen !== SCREEN_PLAY) return;
    if (g.missions.active) {
      g.hud.feed('A job is already running — follow the yellow beacon.');
      return;
    }
    if (g.missions.index >= 4) {
      g.hud.feed('All jobs done. Solara Bay is yours — free roam.');
      return;
    }
    g.missions.start(g.missions.index);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && g.screen === SCREEN_TITLE) startGame(null);
    else if (actions & ACTION_PAUSE && g.screen === SCREEN_PLAY) {
      g.screen = SCREEN_PAUSED;
      g.hud.showScreen(SCREEN_PAUSED);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && g.screen === SCREEN_PAUSED) {
      g.screen = SCREEN_PLAY;
      g.hud.showScreen(SCREEN_PLAY);
      announce('Playing.');
    }
    if (input.pressed('KeyM')) {
      g.audio.ensure();
      g.audio.setMuted(!g.audio.isMuted());
      g.hud.feed(g.audio.isMuted() ? 'Sound muted.' : 'Sound on.');
    }
    if (input.pressed('KeyJ')) startNextMission();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (g.screen === SCREEN_PLAY || g.screen === SCREEN_TITLE) {
      while (accumulator >= STEP && (g.screen === SCREEN_PLAY || g.screen === SCREEN_TITLE)) {
        updateGame(g, STEP, input);
        accumulator -= STEP;
      }
      // The title screen shows the city from a slow orbit.
      if (g.screen === SCREEN_TITLE) {
        const t = g.time * 0.06;
        g.camera.position.set(Math.cos(t) * 120, 46, Math.sin(t) * 120 + 20);
        g.camera.lookAt(0, 6, 0);
      }
    } else {
      accumulator = 0;
    }
    renderer.render(g.scene, g.camera);
    input.endFrame();
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && g.screen === SCREEN_PLAY) {
      g.screen = SCREEN_PAUSED;
      g.hud.showScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Space or click Start to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
