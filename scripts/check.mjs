// Lightweight project checks (no dependencies):
//   1. Syntax check of every first-party JS file
//   2. Every i18n key used in code/HTML exists in both pt-BR and en-US
//   3. No inline event handlers in index.html (required by the CSP)
// Run with: npm run check
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsFiles = [
    ...readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => `js/${f}`),
    ...readdirSync(path.join(root, 'js/ui')).filter(f => f.endsWith('.js')).map(f => `js/ui/${f}`)
];
let failures = 0;

for (const f of jsFiles) {
    try {
        execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' });
    } catch (e) {
        failures++;
        console.error(`✗ syntax: ${f}\n${e.stderr}`);
    }
}

// i18n
globalThis.window = { Lexicon: {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.document = { documentElement: {}, querySelectorAll: () => [], getElementById: () => null };
createRequire(import.meta.url)(path.join(root, 'js/i18n.js'));
const T = globalThis.window.Lexicon.I18n.translations;
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]);
const pt = new Set(flat(T['pt-BR']));
const en = new Set(flat(T['en-US']));
const patterns = [
    /\btr\(\s*'([a-zA-Z]+\.[\w.]+)'/g,
    /\bt\(\s*'([a-zA-Z]+\.[\w.]+)'/g,
    /data-i18n(?:-title|-placeholder|-html|-aria)?="([\w.]+)"/g
];
const used = new Set();
for (const f of ['index.html', ...jsFiles]) {
    const src = readFileSync(path.join(root, f), 'utf8');
    for (const re of patterns) for (const m of src.matchAll(re)) used.add(m[1]);
}
for (const key of used) {
    if (!pt.has(key) || !en.has(key)) {
        failures++;
        console.error(`✗ i18n: "${key}" missing in ${!pt.has(key) ? 'pt-BR ' : ''}${!en.has(key) ? 'en-US' : ''}`);
    }
}
for (const key of pt) if (!en.has(key)) { failures++; console.error(`✗ i18n: "${key}" only in pt-BR`); }
for (const key of en) if (!pt.has(key)) { failures++; console.error(`✗ i18n: "${key}" only in en-US`); }

// CSP: no inline handlers / inline scripts
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const inline = html.match(/\son[a-z]+="[^"]*"/g) || [];
if (inline.length) {
    failures++;
    console.error(`✗ csp: ${inline.length} inline event handler(s) in index.html, e.g. ${inline[0]}`);
}
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) {
    failures++;
    console.error('✗ csp: inline <script> block found in index.html');
}

if (failures) {
    console.error(`\n${failures} problem(s) found.`);
    process.exit(1);
}
console.log(`✓ ${jsFiles.length} JS files OK, ${used.size} i18n keys OK, no inline handlers.`);
