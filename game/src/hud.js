// The HUD: DOM over the canvas — health bar, cash, wanted stars, speed, objective,
// clock, message feed, crosshair, contextual hints, the mission-complete banner,
// and the start / pause / wasted / busted overlays. updateHud is called every
// frame; the text nodes only change when their value does.
import { nearestCar } from './vehicles.js';
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'),
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    cash: $('cash'),
    stars: $('stars'),
    speed: $('speed'),
    clock: $('clock'),
    objective: $('objective'),
    feedBox: $('feed'),
    crosshair: $('crosshair'),
    hint: $('hint'),
    arrow: $('arrow'),
    arrowDist: $('arrow-dist'),
    bannerEl: $('banner'),
    screens: {
      title: $('screen-title'),
      paused: $('screen-paused'),
      wasted: $('screen-wasted'),
      busted: $('screen-busted'),
    },
    startBtn: $('btn-start'),
    continueBtn: $('btn-continue'),
    resumeBtn: $('btn-resume'),
    restartBtn: $('btn-restart'),
    restartBtn2: $('btn-restart2'),
    missionBtn: $('btn-mission'),
    bannerTimer: 0,
    feed(message) {
      if (!hud.feedBox) return;
      const line = document.createElement('div');
      line.className = 'feed-line';
      line.textContent = message;
      hud.feedBox.prepend(line);
      while (hud.feedBox.children.length > 4) hud.feedBox.lastChild.remove();
    },
    setObjective(text) {
      setText(hud.objective, text);
    },
    setWanted(level) {
      setText(hud.stars, '★'.repeat(level) + '☆'.repeat(5 - level));
      hud.stars.classList.toggle('hot', level > 0);
    },
    setArmed(armed) {
      hud.crosshair.style.display = armed ? 'block' : 'none';
    },
    banner(text) {
      setText(hud.bannerEl, text);
      hud.bannerEl.style.opacity = '1';
      hud.bannerTimer = 2.6;
    },
    showScreen(name) {
      for (const key of Object.keys(hud.screens)) {
        hud.screens[key].classList.toggle('hidden', key !== name);
      }
      hud.root.classList.toggle('hidden', name === SCREEN_TITLE);
    },
  };
  return hud;
}

/** Refresh the HUD from the game state; cheap enough to run every frame. */
export function updateHud(g, dt) {
  const hud = g.hud;
  if (hud.bannerTimer > 0) {
    hud.bannerTimer -= dt;
    if (hud.bannerTimer <= 0) hud.bannerEl.style.opacity = '0';
  }
  const p = g.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.healthFill.classList.toggle('low', p.health < 30);
  setText(hud.healthText, `${Math.ceil(Math.max(0, p.health))} HP`);
  setText(hud.cash, `$${g.cash}`);
  const speedKmh = p.car ? Math.round(Math.abs(p.car.speed) * 3.6) : 0;
  setText(hud.speed, p.car ? `${speedKmh} km/h` : '');
  const minutes = Math.floor(g.clockMinutes) % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  setText(hud.clock, `${hh}:${mm}`);
  // Mission arrow: points at the target, with the distance.
  const marker = g.missions.marker();
  if (marker) {
    const dx = marker.x - p.x;
    const dz = marker.z - p.z;
    const worldAngle = Math.atan2(dx, dz);
    const relative = worldAngle - g.cameraYaw - Math.PI;
    hud.arrow.style.display = 'block';
    hud.arrow.style.transform = `translateX(-50%) rotate(${relative}rad)`;
    setText(hud.arrowDist, `${Math.round(Math.hypot(dx, dz))} m`);
  } else {
    hud.arrow.style.display = 'none';
    setText(hud.arrowDist, '');
  }
  // Contextual hint: what E does right now.
  let hint = '';
  if (!p.car) {
    const near = nearestCar(g, p.x, p.z, 4);
    if (near) hint = 'E — Enter car';
    else if (p.armed) hint = 'Click — Shoot · 1 — Fists · F — Punch';
    else hint = '2 — Draw pistol · F — Punch';
  } else {
    hint = 'E — Exit car · Space — Handbrake';
  }
  setText(hud.hint, hint);
}
