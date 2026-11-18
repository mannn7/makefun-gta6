// Pedestrians: locals strolling the sidewalks who scatter when a car screams past
// or a shot rings out, and who fall when a speeding car hits them — which the
// police notice. Each one is a small coloured figure with a walk cycle.
import * as THREE from 'three';
import { CITY_HALF, GRID, PITCH } from './config.js';

const PED_COUNT = 22;
const SHIRTS = [0xd94f30, 0x3a7bd5, 0x3aa655, 0xe8c832, 0x7a4fb5, 0xe87a2e, 0xe8e8e8, 0x8a5a3b];

function createPedMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333a48 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
  torso.position.y = 0.95;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.42;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), pants);
  legL.position.set(-0.13, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  group.add(legL);
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

/** A random sidewalk spot: 9 m off a street centre, on a random street. */
function sidewalkSpot(rng) {
  const alongX = rng.chance(0.5);
  const line = rng.pick([-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => k * PITCH));
  const along = rng.range(-CITY_HALF + 10, CITY_HALF - 10);
  const side = rng.chance(0.5) ? 9 : -9;
  return alongX ? { x: along, z: line + side } : { x: line + side, z: along };
}

export function spawnPedestrians(g) {
  for (let i = 0; i < PED_COUNT; i += 1) {
    const spot = sidewalkSpot(g.rng);
    const mesh = createPedMesh(g.rng.pick(SHIRTS));
    mesh.position.set(spot.x, 0, spot.z);
    g.scene.add(mesh);
    g.peds.push({
      mesh,
      x: spot.x,
      z: spot.z,
      heading: g.rng.range(0, Math.PI * 2),
      speed: g.rng.range(0.9, 1.5),
      phase: g.rng.range(0, 6),
      down: 0,
      flee: 0,
      alongX: g.rng.chance(0.5),
    });
  }
}

export function updatePedestrians(g, dt) {
  const px = g.player.x;
  const pz = g.player.z;
  const playerCar = g.player.car;
  const playerSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
  for (const ped of g.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) {
        // Get up somewhere else, out of the way.
        const spot = sidewalkSpot(g.rng);
        ped.x = spot.x;
        ped.z = spot.z;
        ped.mesh.rotation.x = 0;
        ped.mesh.visible = true;
      }
      continue;
    }
    const dx = ped.x - px;
    const dz = ped.z - pz;
    const dist = Math.hypot(dx, dz);
    // Flee a speeding car or a nearby gunshot.
    if ((playerCar && playerSpeed > 6 && dist < 9) || g.shotNoise > 0) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const fleeSpeed = 5.5;
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      ped.x += nx * fleeSpeed * dt;
      ped.z += nz * fleeSpeed * dt;
      ped.heading = Math.atan2(nx, nz);
    } else {
      // Stroll along the sidewalk; turn around at the city edge.
      const vx = Math.sin(ped.heading);
      const vz = Math.cos(ped.heading);
      ped.x += vx * ped.speed * dt;
      ped.z += vz * ped.speed * dt;
      if (Math.abs(ped.x) > CITY_HALF + 20 || Math.abs(ped.z) > CITY_HALF + 20) {
        ped.heading += Math.PI;
      }
      // Drift back toward a sidewalk line so they never wander into buildings.
      const line = Math.round((ped.alongX ? ped.z : ped.x) / PITCH) * PITCH;
      const off = (ped.alongX ? ped.z : ped.x) - line;
      if (Math.abs(off) > 11) {
        if (ped.alongX) ped.z -= Math.sign(off) * dt * 1.5;
        else ped.x -= Math.sign(off) * dt * 1.5;
      }
    }
    // Hit by the player's car: down they go, and the cops take note.
    if (playerCar && playerSpeed > 4 && dist < 1.9) {
      ped.down = 8;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
      g.police.addWanted(1, 'Pedestrian hit');
      g.hud.feed('You hit a pedestrian! Wanted level up.');
      g.audio.crash();
      continue;
    }
    ped.phase += dt * ped.speed * 4;
    const swing = Math.sin(ped.phase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
  if (g.shotNoise > 0) g.shotNoise -= dt;
}
