// V2 (dusk pass): golden hour is now the default — the clock starts at 18:45
// and PALETTE is a dusk palette (warm orange sun, pink-purple sky, pastel Art
// Deco beach facades, turquoise water), so the city glows instead of glaring.
// MAX_WANTED is 6, matching the real GTA 6 wanted scale.
// Solara Bay: tuning, sizes and palette. One grid, one truth: every system reads the
// street layout from here, so the city, the traffic, the pedestrians and the missions
// all agree about where the roads are.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solara-bay-save-v1';

// City grid: streets run both ways at x = k * PITCH and z = k * PITCH, k in -GRID..GRID.
export const PITCH = 58;
export const GRID = 4;
export const STREET = 14; // road width in metres
export const BLOCK = PITCH - STREET; // building block width
export const CITY_HALF = GRID * PITCH + STREET / 2; // 239: edge of the last street
export const BEACH_Z = CITY_HALF; // sand starts here
export const WATER_Z = CITY_HALF + 62; // the sea starts here
export const WORLD_HALF = 360; // ground plane half-size

// Player
export const WALK_SPEED = 4.2;
export const RUN_SPEED = 8.2;
export const JUMP_SPEED = 7.5;
export const GRAVITY = 20;
export const PLAYER_HEALTH = 100;

// Cars
export const CAR_MAX_SPEED = 30;
export const CAR_ACCEL = 9;
export const CAR_BRAKE = 22;
export const CAR_REVERSE_MAX = 9;
export const CAR_LENGTH = 4.4;
export const CAR_WIDTH = 2.0;

// Wanted
export const MAX_WANTED = 6;

// Clock: the game clock starts at 18:45 — golden hour, the sun low over the sea —
// and runs one game minute every 2 real seconds.
export const CLOCK_START_MINUTES = 18 * 60 + 45;
export const CLOCK_RATE = 0.5; // game minutes per real second

// Dusk palette: golden-hour sun, a pink-purple sky, pastel Art Deco on the beach
// strip, neon after dark, turquoise water. The city glows instead of glaring.
export const PALETTE = {
  sky: 0xff9a5c,
  fog: 0xe8a06a,
  sun: 0xffb36b,
  hemiSky: 0xff9a7a,
  hemiGround: 0x4a3f5e,
  asphalt: 0x2e3138,
  sidewalk: 0xd8c9a8,
  sand: 0xf2ddab,
  water: 0x35d0c0,
  building: [0xf7a8c4, 0x7fd1c0, 0xff8f6b, 0xa8e6b0, 0xfff1d6, 0xc9a8e8, 0xffc98a, 0x9fd8ef],
  // Low-rise pastel facades for the beach strip (Art Deco hotels and bars).
  beach: [0xf7a8c4, 0x7fd1c0, 0xff8f6b, 0xa8e6b0, 0xfff1d6, 0xffc98a, 0xf2b8d8, 0x8ad8c8],
  car: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x22262b, 0x7a4fb5, 0xe87a2e],
  police: 0x1d3fae,
  taxi: 0xf2b705,
};

// The four story missions, in order. Rewards are paid in cash on completion.
// Each job carries Rosa's own words for it — what she says when the job starts,
// shown in the dialogue card while the job runs.
export const MISSIONS = [
  {
    id: 'first-job',
    title: 'M1 · First Job',
    brief: 'Rosa needs a package picked up from the pier and delivered to the Sunset Motel.',
    reward: 500,
    rosa: 'Pier’s quiet tonight, Marco. Grab the package, keep it clean, bring it to the Sunset Motel.',
  },
  {
    id: 'getaway',
    title: 'M2 · Getaway',
    brief: 'Steal the red coupe by the marina. The cops will not like it — lose them at the safehouse.',
    reward: 800,
    rosa: 'That red coupe by the marina is ours. Take it — and shake the SBPD before you reach the safehouse.',
  },
  {
    id: 'collection',
    title: 'M3 · Collection',
    brief: 'Three cash drops are waiting around Solara Bay. Pick them all up.',
    reward: 1200,
    rosa: 'Three drops, three corners of the bay. The gold is already waiting, Marco. Move.',
  },
  {
    id: 'big-score',
    title: 'M4 · The Big Score',
    brief: 'Deliver the gold coupe to the garage on Marina Row. The whole force is on you. Do not stop.',
    reward: 2500,
    rosa: 'The whole bay is watching this one. Garage on Marina Row. Don’t stop for anyone.',
  },
];

// Solara Bay's own radio: one station, four songs of its own. The song playing
// follows the job in progress, so the radio line always matches the moment.
export const RADIO_STATION = 'SOLARA FM 98.6';
export const RADIO_SONGS = [
  'Neon Tide — The Breakwater',
  'Golden Hour — Marina Lights',
  'Palms at Dusk — Café Sol',
  'Salt Air — The Undertow',
];

// The SBPD's beach-patrol callsigns — gulls, piers and tides, not numbers on a
// list. Cruisers take the next free callsign when they roll out.
export const SBPD_CALLSIGNS = ['SOL-12', 'GULL-07', 'PIER-03', 'TIDE-21', 'DUNE-09', 'SHELL-15', 'CORAL-04', 'PALM-02'];

// Car names by paint, so the plate under the speedo names the car you stole.
export const CAR_NAMES = {
  0xc23b2e: 'CORAL GT',
  0xe8c832: 'AURELIA GT',
  0x2e6fc2: 'TIDE RUNNER',
  0x3aa655: 'PALM CRUISER',
  0xe8e8e8: 'SAND DUNE',
  0x22262b: 'NIGHT TIDE',
  0x7a4fb5: 'DUSKLINE',
  0xe87a2e: 'SUNSET GT',
};

// Solara Bay's districts, by where you stand: the plaza, the pier, the marina
// row, the north harbour, and the beach strip everyone calls Ocean Drive.
export function districtAt(x, z) {
  if (z > BEACH_Z - 40) return 'OCEAN DRIVE';
  if (x < -100) return 'PIER DISTRICT';
  if (x > 100) return 'MARINA ROW';
  if (z < -100) return 'NORTH HARBOUR';
  return 'SOLARA PLAZA';
}

// Respect ranks: what the bay calls you, by how many jobs you finished.
export const RESPECT_RANKS = ['NEWCOMER', 'DRIVER', 'FIXER', 'BAY LEGEND'];
