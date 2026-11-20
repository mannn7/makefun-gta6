// V2 (GTA 6 HUD): thin top-left bars — pink health with a heart, teal stamina
// with a bolt, purple focus with an eye; top-right ammo + weapon icon, SIX
// wanted stars with red evidence icons beneath, money and clock top-right.
// The feed no longer uses the series name ("Car theft" instead).
// The HUD: DOM over the canvas, laid out like the real GTA 6 HUD — thin bars
// top-left (pink health with a heart, teal stamina with a bolt, purple focus
// with an eye), ammo + weapon icon and SIX wanted stars top-right with small
// red evidence icons beneath them, money and clock top-right, a light rounded
// minimap bottom-left with a pink route line, a distance readout above it and a
// compass below. updateHud is called every frame; the text nodes only change
// when their value does.
import { nearestCar } from './vehicles.js';
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

const MAX_STARS = 6;

function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'),
    healthFill: $('health-fill'),
    staminaFill: $('stamina-fill'),
    focusFill: $('focus-fill'),
    cash: $('cash'),
    stars: $('stars'),
    evidence: $('evidence'),
    weaponIcon: $('weapon-icon'),
    ammo: $('ammo'),
    speed: $('speed'),
    clock: $('clock'),
    objective: $('objective'),
    feedBox: $('feed'),
    crosshair: $('crosshair'),
    hint: $('hint'),
    arrow: $('arrow'),
    arrowDist: $('arrow-dist'),
    mapDist: $('map-dist'),
    compassDial: $('compass-dial'),
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
      // Six stars: filled white while the heat is on, red at four stars and up,
      // hollow grey for the rest. Beneath them, small red evidence icons show
      // what the police know: the car, then the face, then the CCTV.
      let html = '';
      for (let i = 0; i < MAX_STARS; i += 1) {
        if (i < level) html += `<span class="${level >= 4 ? 's-hot' : 's-on'}">★</span>`;
        else html += '<span class="s-off">☆</span>';
      }
      if (hud.stars.innerHTML !== html) hud.stars.innerHTML = html;
      const icons = [];
      if (level >= 1) icons.push('🚗');
      if (level >= 3) icons.push('👤');
      if (level >= 5) icons.push('📹');
      setText(hud.evidence, icons.join(' '));
    },
    setArmed(armed) {
      hud.crosshair.style.display = armed ? 'block' : 'none';
      setText(hud.weaponIcon, armed ? '🔫' : '👊');
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
  // The Start-job button only matters when no job is running: while a mission
  // is active it would sit in the middle of the frame offering a job that
  // cannot start, so it hides until the job is done.
  if (hud.missionBtn) hud.missionBtn.style.display = g.missions.active ? 'none' : 'block';
  const p = g.player;
  hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
  hud.healthFill.classList.toggle('low', p.health < 30);
  hud.staminaFill.style.width = `${Math.max(0, p.stamina)}%`;
  hud.focusFill.style.width = `${Math.max(0, p.focus)}%`;
  setText(hud.cash, `$${g.cash}`);
  setText(hud.ammo, p.armed ? `${p.ammo}` : '');
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
    setText(hud.mapDist, `${Math.round(Math.hypot(dx, dz))} m`);
  } else {
    hud.arrow.style.display = 'none';
    setText(hud.arrowDist, '');
    setText(hud.mapDist, '');
  }
  // Compass strip under the minimap: the letter for the direction the camera
  // actually faces sits under the pink marker. Each 90° of heading is one
  // 60 px letter. (cameraYaw only steers the on-foot orbit, so the heading is
  // read from the camera itself.)
  if (hud.compassDial) {
    const dx = g.cameraLook.x - g.cameraPos.x;
    const dz = g.cameraLook.z - g.cameraPos.z;
    const heading = ((Math.atan2(dx, -dz) * 180) / Math.PI % 360 + 360) % 360;
    let x = 70 - (heading * 60) / 90;
    // The dial repeats every 240 px (N E S W); wrap the offset so the visible
    // 200 px window always stays inside the 540 px dial.
    x = ((x + 340) % 240 + 240) % 240 - 340;
    hud.compassDial.style.transform = `translateX(${x}px)`;
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
