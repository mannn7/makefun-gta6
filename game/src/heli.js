// R8: SBPD AIR-1 — the police helicopter that joins the chase at four stars.
// A low-poly bird of Solara's own: dark navy body with a warm amber stripe, a
// spinning main rotor and a tail rotor, and a cone of warm light that sweeps
// the street under it, pooling on the road where Marco is. It hovers above the
// player with a slow lag, so it feels like it is hunting, not glued on. It
// only flies while the heat is at four stars or more; below that it stays
// parked out of sight, and the staged screenshots place it by hand.
import * as THREE from 'three';

const HELI_ALT = 26;
const HELI_OFFSET = { x: -8, z: 14 };

function createHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d3fae });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xffb36b });
  // Body: a short fuselage, a glass nose and a tail boom.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), bodyMat);
  body.position.y = 0;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.2), new THREE.MeshLambertMaterial({ color: 0x9fd8ef }));
  nose.position.set(0, -0.1, 2.4);
  group.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.3, 4.24), amberMat);
  stripe.position.y = 0.3;
  group.add(stripe);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat);
  boom.position.set(0, 0.2, -4.0);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.0), darkMat);
  fin.position.set(0, 0.8, -6.0);
  group.add(fin);
  // Skids.
  for (const x of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), darkMat);
    skid.position.set(x, -1.0, 0.4);
    group.add(skid);
  }
  // Main rotor: two long blades on a mast, spinning with the game clock.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), darkMat);
  mast.position.y = 1.0;
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.4;
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), darkMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  group.add(rotor);
  // Tail rotor.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 0.6, -6.0);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.3), darkMat);
    blade.rotation.x = a;
    tailRotor.add(blade);
  }
  group.add(tailRotor);
  // The searchlight: a warm cone from the belly down to the street, plus a
  // glowing pool where the beam lands.
  const coneGeo = new THREE.ConeGeometry(7, HELI_ALT, 20, 1, true);
  coneGeo.translate(0, -HELI_ALT / 2, 0);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }),
  );
  group.add(cone);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -HELI_ALT + 0.15;
  group.add(pool);
  group.userData.rotor = rotor;
  group.userData.tailRotor = tailRotor;
  group.userData.cone = cone;
  group.userData.pool = pool;
  group.visible = false;
  return group;
}

export function createHeli(g) {
  const mesh = createHeliMesh();
  g.scene.add(mesh);
  const heli = {
    mesh,
    active: false,
    x: 0,
    z: 0,
    /** Distance from the heli to the player, for the dispatch panel. */
    dist() {
      return Math.round(Math.hypot(heli.x - g.player.x, heli.z - g.player.z, HELI_ALT));
    },
    /** Place the bird by hand (staged screenshots do this after the last step). */
    place(x, z) {
      heli.x = x;
      heli.z = z;
      heli.active = true;
      mesh.visible = true;
      mesh.position.set(x, HELI_ALT, z);
    },
    hide() {
      heli.active = false;
      mesh.visible = false;
    },
  };
  g.heli = heli;
  return heli;
}

export function updateHeli(g, dt) {
  const heli = g.heli;
  if (!heli) return;
  const want = g.wanted >= 4;
  if (want && !heli.active) {
    heli.active = true;
    heli.mesh.visible = true;
    heli.x = g.player.x + HELI_OFFSET.x;
    heli.z = g.player.z + HELI_OFFSET.z;
  } else if (!want && heli.active) {
    heli.hide();
    return;
  }
  if (!heli.active) return;
  // Drift toward a hover point above and behind the player, with lag.
  const tx = g.player.x + HELI_OFFSET.x;
  const tz = g.player.z + HELI_OFFSET.z;
  const k = Math.min(1, dt * 1.2);
  heli.x += (tx - heli.x) * k;
  heli.z += (tz - heli.z) * k;
  const bob = Math.sin(g.time * 1.3) * 1.2;
  heli.mesh.position.set(heli.x, HELI_ALT + bob, heli.z);
  heli.mesh.rotation.y = Math.atan2(g.player.x - heli.x, g.player.z - heli.z);
  // The rotors spin; the beam sways a little, sweeping the street.
  heli.mesh.userData.rotor.rotation.y += dt * 22;
  heli.mesh.userData.tailRotor.rotation.z += dt * 30;
  const sway = Math.sin(g.time * 0.7) * 0.12;
  heli.mesh.userData.cone.rotation.z = sway;
  heli.mesh.userData.cone.rotation.x = Math.cos(g.time * 0.5) * 0.08;
}
