// Palm City — a make.fun entry (Node 22, standard library only).
//
// What ships: game/ is a self-contained static open-world crime sandbox a desktop browser loads
// offline — game/index.html plus its ES modules, no library and no network request: a streaming
// city grid, on-foot and driving modes, traffic and pedestrians, a police heat system, missions,
// HUD and effects, all rendered with the 2D canvas API in flat colours and no audio assets.
//
// What this file does: it is the hand-in plumbing, not the game. It copies game/ and screenshots/
// from beside this file into the output directory (/output under the grader, MAKEFUN_OUTPUT_DIR
// elsewhere) and writes dossier.json — the summary the judge reads — using the vendored make.fun
// library. Screenshots are optional: a missing screenshots/ source directory is skipped quietly
// instead of crashing the hand-in, since the judge treats the first screenshot by name as a cover.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a directory tree, tolerating a source that does not exist. Returns files copied (0 if skipped). */
function copyTree(source: string, dest: string, label: string): number {
  if (!existsSync(source)) {
    console.warn(`[main] ${label}: no ${source} beside the entry, skipping`);
    return 0;
  }
  cpSync(source, dest, { recursive: true });
  return countFiles(dest);
}

/** Depth-first file count, so the summary reports what actually landed in the output. */
function countFiles(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) total += countFiles(path);
    else total += 1;
  }
  return total;
}

mkdirSync(out, { recursive: true });

const gameFiles = copyTree(join(here, 'game'), join(out, 'game'), 'game');
mkdirSync(join(out, 'screenshots'), { recursive: true });
const shotFiles = copyTree(join(here, 'screenshots'), join(out, 'screenshots'), 'screenshots');

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);

// One line for local debugging; the grader ignores stdout.
console.log(
  `[main] Palm City handed in: ${gameFiles} game file(s), ${shotFiles} screenshot(s), dossier ${Buffer.byteLength(dossier)} bytes -> ${dossierPath}`,
);
