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
export const MAX_WANTED = 5;

// Clock: the game clock starts at 10:30 and runs one game minute every 2 real seconds.
export const CLOCK_START_MINUTES = 10 * 60 + 30;
export const CLOCK_RATE = 0.5; // game minutes per real second

// Sun-soaked palette: warm plaster, terracotta, teal and sand, under a hot blue sky.
export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xd8e8ee,
  sun: 0xffe2b0,
  hemiSky: 0xbfd9ff,
  hemiGround: 0x9a8a68,
  asphalt: 0x3a3d42,
  sidewalk: 0xcfc4ae,
  sand: 0xe8d49a,
  water: 0x2e9bb5,
  building: [0xf2e3c6, 0xe8b48a, 0x9fc4c0, 0xd97b6c, 0xf7ead2, 0x8fb8a8, 0xe6c9a8, 0xc9a06a],
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
