// Checks translations: every t('ns.key') used in src exists in English, and every language has every
// English key. Run: node --experimental-strip-types scripts/check-i18n.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files: string[] = [];
const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(ts|tsx)$/.test(f) && files.push(join(d, f))));
walk(root);

const langs = ['en', 'es', 'de', 'fr', 'it', 'pt'];
const strings: Record<string, Record<string, Record<string, string>>> = {};
for (const f of readdirSync(join(root, 'i18n'))) {
  if (f === 'index.ts') continue;
  const mod = await import(join(root, 'i18n', f));
  strings[f.replace(/\.ts$/, '')] = mod.default;
}

let problems = 0;
const report = (msg: string) => {
  problems++;
  console.log(msg);
};
const has = (ns: string, key: string, lang: string) => {
  const table = strings[ns]?.[lang] ?? {};
  return key in table || `${key}_other` in table;
};
for (const file of files) {
  if (file.includes('/i18n/') || file.endsWith('lib/i18n.ts')) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*['"`]([a-z]+)\.([A-Za-z0-9_]+)['"`]/g)) {
    if (!has(m[1], m[2], 'en')) report(`missing en: ${m[1]}.${m[2]} (${file.slice(root.length)})`);
  }
}
for (const [ns, table] of Object.entries(strings)) {
  for (const key of Object.keys(table.en ?? {})) {
    for (const lang of langs.slice(1)) if (!(key in (table[lang] ?? {}))) report(`missing ${lang}: ${ns}.${key}`);
  }
}
console.log(problems ? `${problems} problem(s)` : 'i18n OK');
process.exit(problems ? 1 : 0);
