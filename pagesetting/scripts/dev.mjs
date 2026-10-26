// Local dev server: `npm run dev` (this computer) or `npm run dev:sandbox` (CodeSandbox).
// Rebuilds pagesetting.js / pagesetting.css on save and serves them, with
// pagesetting.json, from .dev/ on port 8000. See loader.html for using it on the site.
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const host = process.argv[2] || 'localhost';

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts', 'pagesetting.css'],
  bundle: true,
  format: 'iife',
  target: 'es2019',
  sourcemap: true,
  entryNames: 'pagesetting',
  outdir: '.dev',
  logLevel: 'info',
});
await ctx.watch();

// pagesetting.json is read by the panel at runtime: copy it over whenever it changes
// (only if it's valid JSON, so a half-typed edit doesn't break the panel).
fs.mkdirSync('.dev', { recursive: true });
const copySettings = () => {
  try {
    JSON.parse(fs.readFileSync('pagesetting.json', 'utf8'));
    fs.copyFileSync('pagesetting.json', '.dev/pagesetting.json');
    console.log('[dev] pagesetting.json updated - reload the page to use it');
  } catch (err) {
    console.error(`[dev] pagesetting.json is not valid JSON, not updated: ${err.message}`);
  }
};
copySettings();
fs.watchFile('pagesetting.json', { interval: 300 }, copySettings);

const { port } = await ctx.serve({ servedir: '.dev', host, port: 8000 });
console.log(`[dev] serving http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
