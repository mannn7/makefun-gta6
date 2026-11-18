// The minimap: a small 2D canvas in the HUD corner. Roads as dark lines on a
// pale map, the sea along the south edge, the player as a white arrow, the mission
// marker as a yellow diamond, police as flashing blue dots and traffic as grey
// dots. North is up; the map is the whole city at a glance.
import { CITY_HALF, PITCH, GRID, WATER_Z, BEACH_Z } from './config.js';

const SIZE = 220;
const HALF = 300; // metres shown each way from the centre

function toMap(v) {
  return ((v + HALF) / (HALF * 2)) * SIZE;
}

export function drawMinimap(g) {
  const canvas = g.minimapCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Sand and sea.
  ctx.fillStyle = '#d8c9a3';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(0, toMap(BEACH_Z), SIZE, toMap(WATER_Z) - toMap(BEACH_Z));
  ctx.fillStyle = '#2e9bb5';
  ctx.fillRect(0, toMap(WATER_Z), SIZE, SIZE - toMap(WATER_Z));
  // City base.
  ctx.fillStyle = '#c9bda1';
  ctx.fillRect(0, 0, SIZE, toMap(CITY_HALF));
  // Roads.
  ctx.strokeStyle = '#3a3d42';
  ctx.lineWidth = 3;
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
  // Mission marker: a yellow diamond.
  const marker = g.missions.marker();
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
  const px = toMap(g.player.x);
  const py = toMap(g.player.z);
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
}
