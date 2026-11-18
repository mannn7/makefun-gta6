// Solara Bay itself: a procedural coastal city on a street grid. The ground is one
// big plane with a painted canvas texture (asphalt, sidewalks, crosswalks, sand and
// sea), the buildings are a single InstancedMesh of boxes with a lit-window texture,
// and lamps and palms are instanced too, so the whole city draws in a handful of
// calls. buildCity also hands back the data the other systems need: the street
// lines, the building footprints for collision, and named places for the missions.
import * as THREE from 'three';
import { BEACH_Z, BLOCK, CITY_HALF, GRID, PALETTE, PITCH, STREET, WATER_Z, WORLD_HALF } from './config.js';

function groundTexture(rng) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const toPx = (v) => ((v + WORLD_HALF) / (WORLD_HALF * 2)) * S;

  // Base: warm concrete.
  ctx.fillStyle = '#c9bda1';
  ctx.fillRect(0, 0, S, S);
  // Beach sand along the south edge, then the sea.
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(0, toPx(BEACH_Z), S, toPx(WATER_Z) - toPx(BEACH_Z));
  ctx.fillStyle = '#2e9bb5';
  ctx.fillRect(0, toPx(WATER_Z), S, S - toPx(WATER_Z));
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    const y = toPx(WATER_Z + 8 + i * 9 + rng.range(0, 4));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(S * 0.3, y + 4, S * 0.6, y - 4, S, y + 2);
    ctx.stroke();
  }

  // Roads: dark asphalt strips on every street line, both directions.
  ctx.fillStyle = '#3a3d42';
  for (let k = -GRID; k <= GRID; k += 1) {
    const c = toPx(k * PITCH);
    const w = toPx(STREET) - toPx(0);
    ctx.fillRect(c - w / 2, 0, w, toPx(CITY_HALF));
    ctx.fillRect(0, c - w / 2, toPx(CITY_HALF), w);
  }
  // Centre dashes, warm yellow.
  ctx.fillStyle = '#e8c832';
  for (let k = -GRID; k <= GRID; k += 1) {
    const c = toPx(k * PITCH);
    for (let d = -CITY_HALF; d < CITY_HALF; d += 16) {
      ctx.fillRect(c - 1, toPx(d), 2, 8);
      ctx.fillRect(toPx(d), c - 1, 8, 2);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const cx = toPx(i * PITCH);
      const cy = toPx(j * PITCH);
      for (let s = -3; s <= 3; s += 1) {
        ctx.fillRect(cx + s * 3 - 1, cy - 9, 2, 4);
        ctx.fillRect(cx + s * 3 - 1, cy + 5, 2, 4);
        ctx.fillRect(cx - 9, cy + s * 3 - 1, 4, 2);
        ctx.fillRect(cx + 5, cy + s * 3 - 1, 4, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8ddc0';
  ctx.fillRect(0, 0, 128, 256);
  // A grid of windows; most dark glass, some lit warm.
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = Math.random() < 0.35;
      ctx.fillStyle = lit ? '#ffd98a' : '#2e4256';
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A tall glowing column and a floating diamond: the mission beacon. */
export function createBeaconMesh() {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  column.position.y = 30;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.position.y = 14;
  group.add(column);
  group.add(diamond);
  group.userData.diamond = diamond;
  return group;
}

/** Build the city into `scene` and return its layout data. */
export function buildCity(scene, rng) {
  const streets = [];
  for (let k = -GRID; k <= GRID; k += 1) streets.push(k * PITCH);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // Buildings: one InstancedMesh, one box, tinted per instance.
  const boxes = [];
  const winTex = windowTexture();
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  buildingGeo.translate(0, 0.5, 0);
  const buildingMat = new THREE.MeshLambertMaterial({ map: winTex });
  const placements = [];
  for (let i = -GRID; i < GRID; i += 1) {
    for (let j = -GRID; j < GRID; j += 1) {
      // Leave the central plaza and the marina lot open.
      if (i === 0 && j === 0) continue;
      if (i === 3 && j === 3) continue;
      const cx = i * PITCH + PITCH / 2;
      const cz = j * PITCH + PITCH / 2;
      const tall = rng.chance(0.22);
      const w = rng.range(20, 34);
      const d = rng.range(20, 34);
      const h = tall ? rng.range(34, 58) : rng.range(10, 26);
      placements.push({ x: cx, z: cz, w, d, h, color: rng.pick(PALETTE.building) });
      boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    }
  }
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, placements.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  placements.forEach((p, index) => {
    pos.set(p.x, 0, p.z);
    scale.set(p.w, p.h, p.d);
    matrix.compose(pos, quat, scale);
    buildings.setMatrixAt(index, matrix);
    color.setHex(p.color);
    buildings.setColorAt(index, color);
  });
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  scene.add(buildings);

  // Street lamps at every other intersection corner.
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  lampGeo.translate(0, 3, 0);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const lampSpots = [];
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      if ((i + j) % 2 !== 0) continue;
      lampSpots.push({ x: i * PITCH + 8.5, z: j * PITCH + 8.5 });
    }
  }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach((p, index) => {
    matrix.compose(pos.set(p.x, 0, p.z), quat, scale.set(1, 1, 1));
    lamps.setMatrixAt(index, matrix);
  });
  lamps.instanceMatrix.needsUpdate = true;
  scene.add(lamps);
  const bulbGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampSpots.length);
  lampSpots.forEach((p, index) => {
    matrix.compose(pos.set(p.x, 6.1, p.z), quat, scale.set(1, 1, 1));
    bulbs.setMatrixAt(index, matrix);
  });
  bulbs.instanceMatrix.needsUpdate = true;
  scene.add(bulbs);

  // Palm trees along the beachfront and a few sidewalks.
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.5, 6);
  trunkGeo.translate(0, 2.75, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const palmSpots = [];
  for (let k = -GRID; k <= GRID; k += 1) {
    palmSpots.push({ x: k * PITCH + 10, z: BEACH_Z + 8 });
    palmSpots.push({ x: k * PITCH - 10, z: BEACH_Z + 14 });
    if (k % 2 === 0) palmSpots.push({ x: k * PITCH + 10, z: -CITY_HALF + 12 });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const tops = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.2, 3.2, 7),
    new THREE.MeshLambertMaterial({ color: 0x2f7a4a }),
    palmSpots.length,
  );
  palmSpots.forEach((p, index) => {
    matrix.compose(pos.set(p.x, 0, p.z), quat, scale.set(1, 1, 1));
    trunks.setMatrixAt(index, matrix);
    matrix.compose(pos.set(p.x, 6.4, p.z), quat, scale.set(1, 1, 1));
    tops.setMatrixAt(index, matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  tops.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  scene.add(tops);

  // The central plaza gets a fountain and planters so it reads as a place, not
  // an empty lot.
  const stone = new THREE.MeshLambertMaterial({ color: 0xb8a888 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.9, 20), stone);
  basin.position.set(PITCH / 2, 0.45, PITCH / 2);
  scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7, 3.7, 0.25, 20),
    new THREE.MeshLambertMaterial({ color: 0x3fa8c9 }),
  );
  water.position.set(PITCH / 2, 0.85, PITCH / 2);
  scene.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.6, 10), stone);
  column.position.set(PITCH / 2, 1.8, PITCH / 2);
  scene.add(column);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd97b6c }));
  orb.position.set(PITCH / 2, 3.4, PITCH / 2);
  scene.add(orb);
  const planterMat = new THREE.MeshLambertMaterial({ color: 0xb56545 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (const [px, pz] of [[12, 12], [46, 12], [12, 46], [46, 46]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 2.2), planterMat);
    box.position.set(px, 0.5, pz);
    scene.add(box);
    const leaves = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 1.9), leafMat);
    leaves.position.set(px, 1.3, pz);
    scene.add(leaves);
  }

  // Named places the missions use.
  const places = {
    pier: { x: -GRID * PITCH, z: BEACH_Z - 4 },
    motel: { x: GRID * PITCH, z: -GRID * PITCH },
    marina: { x: -GRID * PITCH + 10, z: BEACH_Z - 10 },
    safehouse: { x: -GRID * PITCH, z: -GRID * PITCH },
    garage: { x: GRID * PITCH - 10, z: GRID * PITCH },
    plaza: { x: PITCH / 2, z: PITCH / 2 },
    drops: [
      { x: -2 * PITCH, z: 2 * PITCH },
      { x: 2 * PITCH, z: -1 * PITCH },
      { x: 0, z: -3 * PITCH },
    ],
  };

  return { streets, buildingBoxes: boxes, places };
}

/** Is the point on a road (within the asphalt, either direction)? */
export function onRoad(x, z) {
  const near = (v) => {
    for (let k = -GRID; k <= GRID; k += 1) {
      if (Math.abs(v - k * PITCH) <= STREET / 2) return true;
    }
    return false;
  };
  return near(x) || near(z);
}

/** The nearest street-line coordinate to a value. */
export function nearestStreet(v) {
  let best = -GRID * PITCH;
  let bestD = Infinity;
  for (let k = -GRID; k <= GRID; k += 1) {
    const d = Math.abs(v - k * PITCH);
    if (d < bestD) {
      bestD = d;
      best = k * PITCH;
    }
  }
  return best;
}

/** A random point on a random street, for spawning cars and pedestrians. */
export function randomStreetPoint(rng) {
  const alongX = rng.chance(0.5);
  const line = rng.pick([-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => k * PITCH));
  const along = rng.range(-CITY_HALF + 10, CITY_HALF - 10);
  return alongX ? { x: along, z: line } : { x: line, z: along };
}
