// Solmara Heat — entry program for make.fun bounty gta6-01 (Node 22, stdlib only).
// The game is plain static files under game/ (index.html + ES modules, three.js
// vendored minified under game/vendor/), so this program only has to hand it in:
// copy game/ and screenshots/ beside this file into /output and write the
// dossier.json the judge reads, using the kit's vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps (reference/gate.json): text_max_bytes shapes the dossier's
// bytes; the rest refuse an entry the scorer would refuse outright.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

function isImage(buf) {
  // JPEG magic FF D8 FF, or PNG magic 89 50 4E 47.
  return (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47);
}

function preflight() {
  if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter(f => !f.startsWith('.')).sort();
  if (shots.length < 3 || shots.length > DOSSIER_CAPS.screenshots.max) {
    throw new Error(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const name of shots) {
    const file = join(shotsDir, name);
    const buf = readFileSync(file);
    if (buf.length > DOSSIER_CAPS.screenshots.max_bytes) throw new Error(`${name} is over 256 KiB`);
    if (!isImage(buf)) throw new Error(`${name} is neither PNG nor JPEG`);
  }
  return shots;
}

function countGameFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countGameFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

const shots = preflight();
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
const dossier = buildDossier(out, DOSSIER_CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

const gameFiles = countGameFiles(gameDir);
const gameBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Solmara Heat staged: ${gameFiles} game files, ${shots.length} screenshots (cover ${shots[0]}), dossier ${gameBytes} bytes.`);
