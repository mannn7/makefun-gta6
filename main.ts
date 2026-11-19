// Solara Bay, an open-world crime game for gta6-01 (Node 22, standard library only):
// the game is this directory's game/ folder, plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored as a minified
// build under game/vendor/, no network request), and the program hands it in. It
// copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. Marco Reyes takes jobs from the fixer Rosa Delmar in a sun-soaked
// coastal city: drive and steal cars, outrun the police, run four story missions,
// fight, and watch the wanted stars climb. Put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The grader runs this program twice into the same /output. The copy below is
// manual (readFileSync + writeFileSync) instead of cpSync, so the fresh copy
// never inherits the repository's read-only modes: every run behaves like the
// first, and the previous output is cleared first anyway.

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A previous run's output goes first (force: true is a no-op when it is absent).
for (const name of ['game', 'screenshots', 'dossier.json']) {
  rmSync(join(out, name), { recursive: true, force: true });
}
mkdirSync(out, { recursive: true });

// Copy a tree file by file: readFileSync + writeFileSync creates each file with
// the process's default mode instead of preserving the repository's read-only
// modes, so the fresh copy is writable by its owner from the start.
const copyTree = (src: string, dst: string): void => {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, e.name);
    const to = join(dst, e.name);
    if (e.isDirectory()) {
      copyTree(from, to);
    } else if (e.isFile()) {
      writeFileSync(to, readFileSync(from));
    }
  }
};
copyTree(join(here, 'game'), join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) copyTree(join(here, 'screenshots'), join(out, 'screenshots'));

// Belt and braces: make the fresh tree writable by its owner, so the next run
// clears it the same way.
const makeWritable = (dir: string): void => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      chmodSync(p, 0o755);
      makeWritable(p);
    } else if (e.isFile()) {
      chmodSync(p, 0o644);
    }
  }
};
makeWritable(join(out, 'game'));
makeWritable(join(out, 'screenshots'));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
