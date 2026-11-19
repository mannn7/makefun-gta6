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
export const MISSIONS = [
  {
    id: 'first-job',
    title: 'M1 · First Job',
    brief: 'Rosa needs a package picked up from the pier and delivered to the Sunset Motel.',
    reward: 500,
  },
  {
    id: 'getaway',
    title: 'M2 · Getaway',
    brief: 'Steal the red coupe by the marina. The cops will not like it — lose them at the safehouse.',
    reward: 800,
  },
  {
    id: 'collection',
    title: 'M3 · Collection',
    brief: 'Three cash drops are waiting around Solara Bay. Pick them all up.',
    reward: 1200,
  },
  {
    id: 'big-score',
    title: 'M4 · The Big Score',
    brief: 'Deliver the gold coupe to the garage on Marina Row. The whole force is on you. Do not stop.',
    reward: 2500,
  },
];
