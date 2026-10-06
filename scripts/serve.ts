// Serves dist/ the way the static host will: applies _redirects and _headers,
// resolves directory indexes and falls back to 404.html. Used by `npm run preview`
// and the browser tests so CSP and legacy redirects are exercised before deploy.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..', process.env.DIST ?? 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.usdz': 'model/vnd.usdz+zip',
};

export function startServer(port: number): Promise<Server> {
const redirects = new Map<string, [string, number]>();
for (const line of readFileSync(join(root, '_redirects'), 'utf8').split('\n')) {
  const [from, to, code] = line.trim().split(/\s+/);
  if (from && to) redirects.set(from, [to, Number(code ?? 301)]);
}

const headerRules: { pattern: RegExp; headers: [string, string][] }[] = [];
for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!/^\s/.test(line)) {
    const pattern = new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    headerRules.push({ pattern, headers: [] });
  } else {
    const i = line.indexOf(':');
    headerRules.at(-1)?.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const redirect = redirects.get(path);
  if (redirect) {
    res.writeHead(redirect[1], { Location: redirect[0] });
    res.end();
    return;
  }
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  let status = 200;
  if (!existsSync(file)) {
    if (!path.endsWith('/') && existsSync(join(root, path, 'index.html'))) {
      res.writeHead(301, { Location: `${path}/` }).end();
      return;
    }
    file = join(root, '404.html');
    status = 404;
  }
  for (const rule of headerRules) if (rule.pattern.test(path)) for (const [k, v] of rule.headers) res.setHeader(k, v);
  if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
  res.statusCode = status;
  createReadStream(file).pipe(res);
});
return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  await startServer(port);
  console.log(`Serving dist/ on http://localhost:${port}`);
}
