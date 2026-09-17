/**
 * Minifies the tracker into the client's public dir, so Vite publishes it as a
 * static asset at /v1/tracker.min.js and Amplify serves it from its CDN.
 *
 * Fails the build if the output exceeds the size budget, since this script is
 * loaded on every page of every customer site.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, 'src/tracker.js');
const outFile = resolve(here, '../../apps/client/public/v1/tracker.min.js');

const MAX_BYTES = 2560; // 2.5KB

const BANNER = '/* Alora AI traffic tracker v1 */';

await mkdir(dirname(outFile), { recursive: true });

await build({
  entryPoints: [entry],
  outfile: outFile,
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2017'],
  legalComments: 'none',
  banner: { js: BANNER },
});

// esbuild's `pure`/`drop` options only cover console calls it can prove are
// side-effect free, so assert the shipped artifact is actually clean. The iGEO
// tracker shipped debug logging to production this way.
const output = await readFile(outFile, 'utf8');
if (output.includes('console.')) {
  throw new Error('tracker.min.js contains a console call; remove it before shipping');
}

const bytes = Buffer.byteLength(output, 'utf8');
if (bytes > MAX_BYTES) {
  throw new Error(`tracker.min.js is ${bytes} bytes, over the ${MAX_BYTES} byte budget`);
}

await writeFile(outFile, output);

console.log(`tracker.min.js written (${bytes} bytes, budget ${MAX_BYTES})`);
