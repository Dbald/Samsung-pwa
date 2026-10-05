// Renders each record's runtime GLB to a local WebP poster with model-viewer in
// headless Chromium, so catalog images never depend on third-party hotlinks.
// Usage: npm run posters [-- <product id> ...]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';
import type { ProductRecord } from '../src/catalog/types';
import { ASSETS_DIR, ROOT, readCatalogRaw } from '../src/node/catalog-fs';

const ORIGIN = 'http://posters.local';
const SIZE = 800;
const only = process.argv.slice(2);
const products = (readCatalogRaw().products as ProductRecord[]).filter((p) => !only.length || only.includes(p.id));

const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9">
<script src="/model-viewer.js"></script>
<model-viewer id="mv" style="width:${SIZE}px;height:${SIZE}px;background:#f4f6f9" interaction-prompt="none"
  shadow-intensity="1" exposure="1.05" tone-mapping="neutral"></model-viewer></body></html>`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
await page.route(`${ORIGIN}/**`, (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
  if (path === '/model-viewer.js')
    return route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(ROOT, 'node_modules/@google/model-viewer/dist/model-viewer-umd.min.js')) });
  return route.fulfill({ contentType: 'model/gltf-binary', body: readFileSync(join(ASSETS_DIR, path.slice(1))) });
});
await page.goto(`${ORIGIN}/`);
await page.waitForFunction(() => customElements.get('model-viewer'));

for (const p of products) {
  const dataUrl = await page.evaluate(
    async ({ src, orbit }) => {
      const mv = document.getElementById('mv') as HTMLElement & Record<string, any>;
      const loaded = new Promise((ok, fail) => {
        mv.addEventListener('load', ok, { once: true });
        mv.addEventListener('error', fail, { once: true });
      });
      mv.setAttribute('camera-orbit', orbit);
      mv.setAttribute('src', src);
      await loaded;
      mv.jumpCameraToGoal();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const blob: Blob = await mv.toBlob({ mimeType: 'image/webp', qualityArgument: 0.82, idealAspect: false });
      return await new Promise<string>((r) => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result as string);
        fr.readAsDataURL(blob);
      });
    },
    { src: `${ORIGIN}/${p.assets.model}`, orbit: p.assets.cameraOrbit },
  );
  const out = join(ASSETS_DIR, p.assets.poster);
  mkdirSync(dirname(out), { recursive: true });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(out, buf);
  console.log(`${p.id}: ${p.assets.poster} (${(buf.length / 1024).toFixed(0)} KB)`);
}
await browser.close();
