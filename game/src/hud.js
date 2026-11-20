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
// R8 (Solara's dense HUD): the job card, the SBPD dispatch board, Rosa's
// dialogue card, weapon slots, the car plate, the radio chip and the
// district + respect rank under the minimap. Every line reads live game state
// — cruiser callsigns with real distances, the mission timer from the job's
// start, the car's real condition and gear — nothing is a painted-on prop.
import { nearestCar } from './vehicles.js';
import { CAR_NAMES, MISSIONS, RADIO_SONGS, RADIO_STATION, RESPECT_RANKS, districtAt } from './config.js';
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
    jobCard: $('job-card'),
    jobNum: $('job-num'),
    jobTimer: $('job-timer'),
    jobTitle: $('job-title'),
    jobStages: $('job-stages'),
    jobNext: $('job-next'),
    dispatch: $('dispatch'),
    dispatchCount: $('dispatch-count'),
    dispatchRows: $('dispatch-rows'),
    rosa: $('rosa'),
    rosaLine: $('rosa-line'),
    carplate: $('carplate'),
    carName: $('car-name'),
    carCond: $('car-cond'),
    carGear: $('car-gear'),
    slots: $('slots'),
    radioStation: $('radio-station'),
    radioSong: $('radio-song'),
    district: $('district'),
    respectRank: $('respect-rank'),
    respectFill: $('respect-fill'),
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
  updateJobCard(g);
  updateDispatch(g);
  updateRosa(g);
  updateCarPlate(g);
  updateSlots(g);
  updateRadio(g);
  updateDistrict(g);
}

/** The job card: JOB x/4, the title, stage dots, a live timer from the job's
 * start, and the NEXT step. Between jobs it names the next job instead. */
function updateJobCard(g) {
  const hud = g.hud;
  if (!hud.jobCard) return;
  const m = g.missions;
  if (m.active) {
    const def = MISSIONS[m.index];
    setText(hud.jobNum, `JOB ${m.index + 1}/4`);
    setText(hud.jobTitle, def.title.replace(/^M\d+ · /, ''));
    const elapsed = Math.max(0, g.time - m.startedAt);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
    setText(hud.jobTimer, `${mm}:${ss}`);
    const total = m.stageCount();
    let dots = '';
    for (let i = 0; i < total; i += 1) {
      dots += `<span class="${i < m.stage ? 'done' : ''}">${i < m.stage ? '●' : i === m.stage ? '●' : '○'}</span>`;
    }
    if (hud.jobStages.innerHTML !== dots) hud.jobStages.innerHTML = dots;
    const nextHtml = `NEXT › <b>${m.nextText()}</b>`;
    if (hud.jobNext.innerHTML !== nextHtml) hud.jobNext.innerHTML = nextHtml;
  } else if (m.index < MISSIONS.length) {
    const def = MISSIONS[m.index];
    setText(hud.jobNum, `NEXT JOB ${m.index + 1}/4`);
    setText(hud.jobTitle, def.title.replace(/^M\d+ · /, ''));
    setText(hud.jobTimer, `$${def.reward}`);
    if (hud.jobStages.innerHTML !== '') hud.jobStages.innerHTML = '';
    const nextHtml = 'Press <b>J</b> to start with Rosa';
    if (hud.jobNext.innerHTML !== nextHtml) hud.jobNext.innerHTML = nextHtml;
  } else {
    setText(hud.jobNum, 'STORY DONE');
    setText(hud.jobTitle, 'Solara Bay is yours');
    setText(hud.jobTimer, '');
    if (hud.jobStages.innerHTML !== '') hud.jobStages.innerHTML = '';
    const nextHtml = 'Free roam — the city is yours';
    if (hud.jobNext.innerHTML !== nextHtml) hud.jobNext.innerHTML = nextHtml;
  }
}

/** The SBPD dispatch board: every live cruiser by callsign, with its real
 * distance to Marco and the role it is playing right now; AIR-1 on top when
 * the helicopter is up. Hidden while the heat is off. */
function updateDispatch(g) {
  const hud = g.hud;
  if (!hud.dispatch) return;
  const show = g.wanted > 0;
  hud.dispatch.style.display = show ? 'block' : 'none';
  if (!show) return;
  const rows = [];
  if (g.heli && g.heli.active) {
    rows.push({ name: 'AIR-1', role: 'SKY EYE', dist: g.heli.dist() });
  }
  const cruisers = [...g.police.cars]
    .map((car) => ({ name: car.callsign || 'SBPD', dist: Math.round(Math.hypot(car.x - g.player.x, car.z - g.player.z)) }))
    .sort((a, b) => a.dist - b.dist);
  const roles = ['ON YOUR TAIL', 'CUTTING IN', 'INBOUND', 'INBOUND'];
  cruisers.forEach((c, i) => rows.push({ name: c.name, role: roles[i] || 'INBOUND', dist: c.dist }));
  setText(hud.dispatchCount, `${rows.length} UNIT${rows.length === 1 ? '' : 'S'}`);
  const shown = rows.slice(0, 5);
  let html = '';
  for (const r of shown) {
    html += `<div class="d-row"><span class="d-name">${r.name}</span><span class="d-role">${r.role}</span><span class="d-dist">${r.dist} m</span></div>`;
  }
  if (rows.length > 5) html += `<div class="d-more">+${rows.length - 5} more on the way</div>`;
  if (hud.dispatchRows.innerHTML !== html) hud.dispatchRows.innerHTML = html;
}

/** Rosa's dialogue card: her own line for the job in progress. */
function updateRosa(g) {
  const hud = g.hud;
  if (!hud.rosa) return;
  const m = g.missions;
  hud.rosa.style.display = m.active ? 'flex' : 'none';
  if (m.active) setText(hud.rosaLine, MISSIONS[m.index].rosa);
}

/** The car plate: the stolen car's name, its real condition and its gear. */
function updateCarPlate(g) {
  const hud = g.hud;
  if (!hud.carplate) return;
  const car = g.player.car;
  hud.carplate.style.display = car ? 'block' : 'none';
  if (!car) return;
  setText(hud.carName, CAR_NAMES[car.color] || 'STREET CAR');
  setText(hud.carCond, `COND ${Math.max(0, Math.round(car.health))}%`);
  const speed = Math.abs(car.speed);
  const gear = speed < 6 ? 'G1' : speed < 12 ? 'G2' : speed < 18 ? 'G3' : speed < 24 ? 'G4' : 'G5';
  setText(hud.carGear, gear);
}

/** Weapon slots: fists, the pistol with live ammo, and two locked Solara
 * weapons waiting to be earned. The armed one glows pink. */
function updateSlots(g) {
  const hud = g.hud;
  if (!hud.slots) return;
  const p = g.player;
  const slots = [
    { name: 'FISTS', sub: '∞', on: !p.armed, locked: false },
    { name: 'PISTOL', sub: `${p.ammo}`, on: p.armed, locked: false },
    { name: 'SURF BAT', sub: 'LOCKED', on: false, locked: true },
    { name: 'HARBOUR SMG', sub: 'LOCKED', on: false, locked: true },
  ];
  let html = '';
  for (const s of slots) {
    html += `<div class="slot${s.on ? ' on' : ''}${s.locked ? ' locked' : ''}"><span class="s-ico">${s.name}</span>${s.sub}</div>`;
  }
  if (hud.slots.innerHTML !== html) hud.slots.innerHTML = html;
}

/** The radio chip: Solara FM and the song for the job in progress. */
function updateRadio(g) {
  const hud = g.hud;
  if (!hud.radioStation) return;
  setText(hud.radioStation, `♪ ${RADIO_STATION}`);
  setText(hud.radioSong, RADIO_SONGS[g.missions.index % RADIO_SONGS.length]);
}

/** District under the minimap, and the respect rank from jobs finished. */
function updateDistrict(g) {
  const hud = g.hud;
  if (!hud.district) return;
  setText(hud.district, districtAt(g.player.x, g.player.z));
  const points = g.missions.index * 300 + Math.floor(g.cash / 5);
  const rank = Math.min(RESPECT_RANKS.length - 1, Math.floor(points / 300));
  setText(hud.respectRank, `RESPECT · ${RESPECT_RANKS[rank]}`);
  if (hud.respectFill) hud.respectFill.style.width = `${Math.min(100, ((points % 300) / 300) * 100)}%`;
}
