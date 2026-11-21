// Palm City — hand-in program for the make.fun "Make GTA 6" bounty (gta6-01).
//
// Palm City is an original top-down open-world crime game: a seeded sun-soaked coastal
// grid city with a beach and palms, pedestrians and lane traffic, cars you can steal and
// drive, a five-star wanted level and police cruisers that chase you, gunfights, pickups,
// a seven-job story chain, and a live circular minimap on the HUD. The game itself is
// plain static files under game/ (classic scripts, no build step, no network request);
// this program only hands the entry in.
//
// It copies game/ and screenshots/ from beside this file into the output directory
// (/output inside the grader, MAKEFUN_OUTPUT_DIR outside it), then writes the dossier the
// judge reads with buildDossier from the kit's vendored library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, passed straight through so the dossier refuses what the gate refuses.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy one directory into the output tree; a missing source is a warning, not a failure. */
function copyDir(name: string): boolean {
  const from = join(here, name);
  if (!existsSync(from)) {
    process.stderr.write(`[palm-city] no ${name}/ to copy\n`);
    return false;
  }
  mkdirSync(join(outDir, name), { recursive: true });
  cpSync(from, join(outDir, name), { recursive: true });
  return true;
}

/** Total regular files and bytes under a directory, for the one-line summary. */
function tally(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (p: string): void => {
    let entries;
    try {
      entries = readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(p, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        files += 1;
        bytes += statSync(full).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

mkdirSync(outDir, { recursive: true });

const haveGame = copyDir('game');
const haveShots = copyDir('screenshots');

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const game = haveGame ? tally(join(outDir, 'game')) : { files: 0, bytes: 0 };
const shot = haveShots ? tally(join(outDir, 'screenshots')).files : 0;
const title = (() => {
  try {
    const html = readFileSync(join(outDir, 'game', 'index.html'), 'utf8');
    return /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? 'untitled';
  } catch {
    return 'untitled';
  }
})();

process.stdout.write(
  `[palm-city] ${title} — game ${game.files} files / ${game.bytes} bytes, ${shot} screenshots, dossier ${dossier.length} bytes -> ${outDir}\n`,
);
