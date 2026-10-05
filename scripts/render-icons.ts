// Rasterizes assets/icons/icon.svg into the PNG sizes the web app manifest and iOS need.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ASSETS_DIR } from '../src/node/catalog-fs';

const svg = readFileSync(join(ASSETS_DIR, 'icons/icon.svg'), 'utf8');
// Maskable icons keep content inside the central 80% safe zone on a full-bleed background.
const maskable = svg.replace('rx="96"', 'rx="0"').replace('<g ', '<g transform="translate(51.2 51.2) scale(0.8)" ');
const targets = [
  { file: 'icon-192.png', size: 192, svg },
  { file: 'icon-512.png', size: 512, svg },
  { file: 'icon-maskable-512.png', size: 512, svg: maskable },
  { file: 'apple-touch-icon.png', size: 180, svg: maskable },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${t.svg}`);
  await page.screenshot({ path: join(ASSETS_DIR, 'icons', t.file), omitBackground: true });
  await page.close();
  console.log(`icons/${t.file}`);
}
await browser.close();
