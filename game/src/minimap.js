// V2 (GTA 6 map): the minimap is a light plate (cream city, sand, turquoise
// sea) with a pink route line to the target, and it tints red-pink while the
// police are searching — like the real GTA 6 rounded-rectangle light map.
// The minimap: a small 2D canvas in the HUD corner, drawn on a light plate like
// the real GTA 6 map. Roads as grey lines on cream, the sea along the south edge,
// the route to the target as a pink line, the player as a white arrow, the
// mission marker as a yellow diamond, police as flashing dots and traffic as
// grey dots. While the police are searching (wanted, but no cruiser in sight)
// the whole map tints red-pink. North is up; the map is the whole city at a glance.
import { CITY_HALF, PITCH, GRID, WATER_Z, BEACH_Z } from './config.js';

const SIZE = 200;
const HALF = 300; // metres shown each way from the centre

function toMap(v) {
  return ((v + HALF) / (HALF * 2)) * SIZE;
}

export function drawMinimap(g) {
  const canvas = g.minimapCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Light plate: cream city, sand, turquoise sea.
  ctx.fillStyle = '#f2ead8';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#f0dca8';
  ctx.fillRect(0, toMap(BEACH_Z), SIZE, toMap(WATER_Z) - toMap(BEACH_Z));
  ctx.fillStyle = '#35d0c0';
  ctx.fillRect(0, toMap(WATER_Z), SIZE, SIZE - toMap(WATER_Z));
  ctx.fillStyle = '#e8dfc8';
  ctx.fillRect(0, 0, SIZE, toMap(CITY_HALF));
  // Roads.
  ctx.strokeStyle = '#8a8f96';
  ctx.lineWidth = 2.5;
  for (let k = -GRID; k <= GRID; k += 1) {
    const c = toMap(k * PITCH);
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, toMap(CITY_HALF));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(toMap(CITY_HALF), c);
    ctx.stroke();
  }
  const marker = g.missions.marker();
  const px = toMap(g.player.x);
  const py = toMap(g.player.z);
  // The route: a pink line from the player to the target, bent along the
  // streets (east-west first, then north-south) the way a sat-nav would draw it.
  if (marker) {
    const mx = toMap(marker.x);
    const my = toMap(marker.z);
    ctx.strokeStyle = '#ff4f9a';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(mx, py);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(mx, py);
    ctx.lineTo(mx, my);
    ctx.stroke();
  }
  // Mission marker: a yellow diamond.
  if (marker) {
    const mx = toMap(marker.x);
    const my = toMap(marker.z);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(mx, my - 7);
    ctx.lineTo(mx + 6, my);
    ctx.lineTo(mx, my + 7);
    ctx.lineTo(mx - 6, my);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Traffic: small grey dots.
  ctx.fillStyle = '#6a6f76';
  for (const car of g.cars) {
    if (car.kind !== 'traffic') continue;
    ctx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
  }
  // Police: flashing blue dots.
  const blink = Math.floor(g.time * 3) % 2 === 0;
  ctx.fillStyle = blink ? '#2244ff' : '#ff2222';
  for (const car of g.police.cars) {
    ctx.beginPath();
    ctx.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: a white arrow pointing where he faces.
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.player.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // While the police are searching, the whole map tints red-pink.
  if (g.wanted > 0 && g.police.searching) {
    ctx.fillStyle = 'rgba(255,60,90,0.16)';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
}
