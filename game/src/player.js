// Marco Reyes on foot: a simple jointed figure (torso, head, swinging legs and
// arms) that runs where the camera points, jumps with gravity, and turns to face
// where he is going. Movement is camera-relative, so W always runs away from the
// camera and the orbit mouse never fights the keys.
import * as THREE from 'three';
import { GRAVITY, JUMP_SPEED, RUN_SPEED, WALK_SPEED } from './config.js';

/** The player figure, built from boxes and spheres in a teal jacket. */
export function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e8b8b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b3242 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.78;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0xd94f30 }));
  cap.position.y = 1.94;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), pants);
  legL.position.set(-0.17, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legL);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), jacket);
  armL.position.set(-0.42, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armL);
  group.add(armR);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

/** Move on foot: camera-relative WASD, Shift to run, Space to jump. */
export function updatePlayerOnFoot(g, dt, input) {
  const p = g.player;
  const axis = input.moveAxis();
  const running = input.held('ShiftLeft') || input.held('ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  const camYaw = g.cameraYaw;
  // Camera-relative: forward is away from the camera.
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const rx = -fz;
  const rz = fx;
  let mx = fx * axis.y + rx * axis.x;
  let mz = fz * axis.y + rz * axis.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    const targetHeading = Math.atan2(mx, mz);
    let diff = targetHeading - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += diff * Math.min(1, dt * 12);
    p.walkPhase += dt * speed * 1.6;
    p.moving = true;
  } else {
    p.moving = false;
    p.walkPhase += dt * 2;
  }
  // Jump and gravity.
  if (input.pressed('Space') && p.y === 0) {
    p.vy = JUMP_SPEED;
  }
  p.vy -= GRAVITY * dt;
  p.y = Math.max(0, p.y + p.vy * dt);
  if (p.y === 0) p.vy = 0;
  // Keep out of buildings and inside the city.
  for (const b of g.city.buildingBoxes) {
    const r = 0.6;
    if (p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r) {
      const dxl = p.x - (b.minX - r);
      const dxr = b.maxX + r - p.x;
      const dzl = p.z - (b.minZ - r);
      const dzr = b.maxZ + r - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = b.minX - r;
      else if (m === dxr) p.x = b.maxX + r;
      else if (m === dzl) p.z = b.minZ - r;
      else p.z = b.maxZ + r;
    }
  }
  const lim = 300;
  p.x = Math.max(-lim, Math.min(lim, p.x));
  p.z = Math.max(-lim, Math.min(lim + 58, p.z));
  // Pose the figure: legs and arms swing with the walk, faster when running.
  const swing = p.moving ? Math.sin(p.walkPhase) * (running ? 0.85 : 0.6) : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  u.torso.position.y = 1.15 + Math.abs(Math.sin(p.walkPhase)) * (p.moving ? 0.05 : 0.01);
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
}
