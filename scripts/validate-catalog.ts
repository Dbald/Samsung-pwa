// Validates catalog/ and the assets it references.
//   npm run validate           preview rules: structural problems fail, pending verification warns
//   npm run validate:release   release rules: anything unverified or unapproved also fails
import { formatReport, loadCatalog } from '../src/node/catalog-fs';

const release = process.argv.includes('--release');
const { errors, warnings, catalog, stats } = await loadCatalog({ release });

for (const p of catalog.products ?? []) {
  const s = stats.get(p?.assets?.model);
  if (s) console.log(`${p.id}: ${(s.bytes / 1e6).toFixed(2)} MB, ${s.triangles} triangles, ${s.size.map((n) => n.toFixed(3)).join(' × ')}`);
}
const report = formatReport({ errors, warnings });
if (report) console.log(report);
console.log(errors.length ? `\nCatalog is not ${release ? 'release' : 'build'}-ready.` : `\n✔ Catalog passes ${release ? 'release' : 'preview'} validation.`);
process.exit(errors.length ? 1 : 0);
