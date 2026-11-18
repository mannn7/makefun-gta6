// The story: Marco Reyes, a driver new to Solara Bay, takes jobs from Rosa
// Delmar, a fixer who pays in cash and never asks questions. Four missions in
// order, each with stages, a 3D beacon on the target, a HUD objective line, and a
// cash reward. Completing one unlocks the next and saves progress.
import { MISSIONS } from './config.js';
import { createBeaconMesh } from './city.js';
import { makeCar } from './vehicles.js';

/** Where each mission stage points, and what reaching it does. */
function missionStages(g, index) {
  const places = g.city.places;
  switch (index) {
    case 0:
      return [
        { pos: places.pier, radius: 6, text: 'Pick up the package at the pier', onArrive: () => g.hud.feed('Package collected. Deliver it to the Sunset Motel.') },
        { pos: places.motel, radius: 6, text: 'Deliver the package to the Sunset Motel', onArrive: () => {} },
      ];
    case 1:
      return [
        { pos: places.marina, radius: 5, text: 'Steal the red coupe at the marina', onArrive: () => {}, steal: true },
        { pos: places.safehouse, radius: 7, text: 'Get to the safehouse — lose the cops', onArrive: () => {}, escape: true },
      ];
    case 2:
      return places.drops.map((pos, i) => ({
        pos,
        radius: 4,
        text: `Collect the cash drops (${i + 1} of 3 collected)`,
        onArrive: () => {},
      }));
    case 3:
      return [
        { pos: places.garage, radius: 7, text: 'Deliver the gold coupe to the garage on Marina Row', onArrive: () => {}, deliver: true },
      ];
    default:
      return [];
  }
}

export function createMissions(g) {
  const beacon = createBeaconMesh();
  beacon.visible = false;
  g.scene.add(beacon);
  const missions = {
    index: 0, // which mission is active; MISSIONS.length means the story is done
    stage: 0,
    active: false,
    collected: 0,
    beacon,
    target: null,
    objective: 'Talk to Rosa to start your first job.',
    /** The marker the minimap and the HUD arrow point at, or null. */
    marker() {
      if (!missions.active) return null;
      const stage = missionStages(g, missions.index)[missions.stage];
      if (!stage) return null;
      return stage.pos;
    },
    start(index) {
      missions.index = index;
      missions.stage = 0;
      missions.collected = 0;
      missions.active = true;
      const def = MISSIONS[index];
      g.hud.feed(`Mission: ${def.title} — ${def.brief}`);
      g.hud.setObjective(missions.objectiveText());
      // M2 and M4 need their special cars in the world.
      if (index === 1) {
        const p = g.city.places.marina;
        const car = makeCar(g, p.x, p.z + 4, Math.PI / 2, 0xc23b2e, 'parked');
        car.special = 'getaway';
      }
      if (index === 3) {
        const p = g.city.places.plaza;
        const car = makeCar(g, p.x + 6, p.z, 0, 0xe8c832, 'parked');
        car.special = 'score';
        g.police.addWanted(3, 'The whole force is after you');
      }
      missions.placeBeacon();
    },
    objectiveText() {
      if (!missions.active) {
        return missions.index >= MISSIONS.length
          ? 'All missions complete — Solara Bay is yours. Free roam.'
          : 'Press J to start the next job with Rosa.';
      }
      const stage = missionStages(g, missions.index)[missions.stage];
      return stage ? stage.text : '';
    },
    placeBeacon() {
      const stage = missionStages(g, missions.index)[missions.stage];
      if (stage && missions.active) {
        beacon.position.set(stage.pos.x, 0, stage.pos.z);
        beacon.visible = true;
        missions.target = stage.pos;
      } else {
        beacon.visible = false;
        missions.target = null;
      }
    },
    complete() {
      const def = MISSIONS[missions.index];
      g.cash += def.reward;
      g.audio.jingle();
      g.hud.banner(`Mission complete — $${def.reward}`);
      g.hud.feed(`Rosa paid you $${def.reward}. Total cash: $${g.cash}.`);
      missions.index += 1;
      missions.stage = 0;
      missions.active = false;
      missions.placeBeacon();
      g.save();
      if (missions.index < MISSIONS.length) {
        g.hud.setObjective(`Next job ready — press J to start ${MISSIONS[missions.index].title}.`);
      } else {
        g.hud.setObjective('All missions complete — Solara Bay is yours. Free roam.');
      }
    },
    fail(reason) {
      g.audio.fail();
      g.hud.banner(`Mission failed — ${reason}`);
      missions.stage = 0;
      missions.placeBeacon();
    },
  };
  g.missions = missions;
  return missions;
}

export function updateMissions(g, dt) {
  const m = g.missions;
  // The beacon's diamond bobs and spins.
  if (m.beacon.visible) {
    m.beacon.userData.diamond.rotation.y += dt * 2;
    m.beacon.userData.diamond.position.y = 14 + Math.sin(g.time * 2) * 1.2;
  }
  if (!m.active) return;
  const stages = missionStages(g, m.index);
  const stage = stages[m.stage];
  if (!stage) return;
  const d = Math.hypot(g.player.x - stage.pos.x, g.player.z - stage.pos.z);
  // M2 stage 1: stealing the marked car is the objective, not just arriving.
  if (stage.steal) {
    const car = g.cars.find((c) => c.special === 'getaway');
    if (car && car.kind === 'player') {
      g.police.addWanted(2, 'You stole the coupe');
      g.hud.feed('The coupe is yours. Lose the cops at the safehouse!');
      m.stage += 1;
      m.placeBeacon();
      g.hud.setObjective(m.objectiveText());
    }
    return;
  }
  // M4: the gold coupe must be the car you are driving when you arrive.
  if (stage.deliver) {
    const car = g.player.car;
    if (car && car.special === 'score' && d < stage.radius) {
      m.complete();
    }
    return;
  }
  if (d < stage.radius) {
    stage.onArrive();
    if (m.index === 1 && m.stage === 1) {
      // Escape stage: the marker only counts once the heat is gone.
      if (g.wanted === 0) {
        m.complete();
        return;
      }
      g.hud.feed('The cops are still on you — lose them first!');
      return;
    }
    if (m.index === 2) m.collected += 1;
    m.stage += 1;
    if (m.stage >= stages.length) {
      m.complete();
    } else {
      m.placeBeacon();
      g.hud.setObjective(m.objectiveText());
      g.audio.blip();
    }
  }
}
