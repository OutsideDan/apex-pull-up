#!/usr/bin/env node
/**
 * pre-deploy.js
 * Runs automatically before every `npm run deploy` via the predeploy hook.
 *
 * Checks (blocks deploy on failures marked ✗, warns on ⚠):
 *   Accessibility  — input labels, button names, <title>, lang, viewport
 *   Performance    — file size, defer on scripts, preconnect hints, icons present
 *   Integrity      — manifest.json valid, CDN URLs reachable, version pin sanity
 *   Code quality   — inline JS syntax
 *   CSS health     — dead variables, theme completeness
 *   Hygiene        — no console.log, no localhost URLs
 *
 * --check-only  Run checks and print results; skip git/docs work.
 *
 * App-specific extensions:
 *   - To check localStorage key consistency, define CANONICAL_KEYS below
 *     and uncomment the block in CODE QUALITY.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check-only');

// Read app name from package.json for the report header.
let APP_NAME = 'webapp';
try { APP_NAME = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).name || APP_NAME; }
catch { /* keep default */ }

function read(rel)        { return readFileSync(resolve(ROOT, rel), 'utf8'); }
function write(rel, text) { writeFileSync(resolve(ROOT, rel), text, 'utf8'); }
function exists(rel)      { return existsSync(resolve(ROOT, rel)); }
function git(cmd)         { return execSync(cmd, { cwd: ROOT }).toString().trim(); }

const html = read('index.html');

// Extract the <style> and inline <script> blocks for deeper analysis
const cssBlock    = html.match(/<style>([\s\S]+?)<\/style>/)?.[1]                              ?? '';
const scriptBlock = [...html.matchAll(/<script(?!\s+src)[^>]*>([\s\S]+?)<\/script>/g)].pop()?.[1] ?? '';

// ── Result collector ──────────────────────────────────────────────────────────

const results = { pass: [], warn: [], fail: [] };
function pass(msg) { results.pass.push(msg); }
function warn(msg) { results.warn.push(msg); }
function fail(msg) { results.fail.push(msg); }

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

const inputIds  = [...html.matchAll(/<input[^>]+\bid="([^"]+)"/g)].map(m => m[1]);
const labelFors = [...html.matchAll(/<label[^>]+\bfor="([^"]+)"/g)].map(m => m[1]);
const unlabeled = inputIds.filter(id => !labelFors.includes(id));
if (unlabeled.length === 0) {
  pass('All <input> elements have associated <label for="...">');
} else {
  unlabeled.forEach(id => fail(`<input id="${id}"> has no matching <label for="${id}">`));
}

const buttonMatches = [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
let emptyButtons = 0;
for (const [, attrs, content] of buttonMatches) {
  if (!content.trim() && !/aria-label\s*=/i.test(attrs) && !/\btitle\s*=/i.test(attrs)) emptyButtons++;
}
emptyButtons === 0
  ? pass('All <button> elements have accessible names')
  : warn(`${emptyButtons} button(s) have no text, aria-label, or title`);

/<title>[^<]+<\/title>/.test(html)
  ? pass('Page has a <title>')
  : fail('Missing <title> element');

/<html[^>]+\blang\s*=/.test(html)
  ? pass('<html> has lang attribute')
  : warn('<html> is missing a lang attribute');

/name="viewport"/.test(html)
  ? pass('Viewport meta tag present')
  : fail('Missing viewport meta tag — app will not scale on phones');

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

const sizeKB = Math.round(statSync(resolve(ROOT, 'index.html')).size / 1024);
if      (sizeKB > 500) fail(`index.html is ${sizeKB} KB — exceeds 500 KB hard limit`);
else if (sizeKB > 250) warn(`index.html is ${sizeKB} KB — over 250 KB, watch this`);
else                   pass(`index.html is ${sizeKB} KB — within budget`);

const scriptTags = [...html.matchAll(/<script\s+src="([^"]+)"([^>]*)>/g)];
let missingDefer = 0;
for (const [, src, attrs] of scriptTags) {
  if (!/\bdefer\b/.test(attrs) && !/\basync\b/.test(attrs)) {
    warn(`Script without defer/async (blocks render): ${src}`);
    missingDefer++;
  }
}
if (missingDefer === 0) pass('All external <script> tags have defer or async');

for (const host of ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com']) {
  if (html.includes(host)) {
    html.includes(`preconnect" href="https://${host}`)
      ? pass(`preconnect hint present for ${host}`)
      : warn(`Missing <link rel="preconnect"> for ${host}`);
  }
}

const missingIcons = ['favicon-16x16.png','favicon-32x32.png','apple-touch-icon.png','icon-192.png','icon-512.png']
  .filter(f => !exists(f));
missingIcons.length === 0
  ? pass('All favicon/icon files present')
  : missingIcons.forEach(f => warn(`Missing icon file: ${f} — run: npm run icons`));

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════

if (!exists('manifest.json')) {
  fail('manifest.json not found');
} else {
  try {
    const m = JSON.parse(read('manifest.json'));
    const missingFields = ['name', 'icons', 'start_url'].filter(k => !(k in m));
    if (missingFields.length === 0) {
      pass(`manifest.json valid — name: "${m.name}", start_url: "${m.start_url}", icons: ${m.icons.length}`);
    } else {
      missingFields.forEach(k => fail(`manifest.json missing required field: "${k}"`));
    }
  } catch (e) {
    fail(`manifest.json is not valid JSON: ${e.message}`);
  }
}

const cdnUrls = [...html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
for (const url of cdnUrls) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    res.ok
      ? pass(`CDN reachable (${res.status}): ${url}`)
      : warn(`CDN returned ${res.status}: ${url}`);
  } catch {
    warn(`CDN unreachable (network issue or timeout): ${url}`);
  }
}

// Vague version pins ("@4" instead of "@4.5.1") risk silent breakage on major bumps.
for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  if (/@\d+(?:[^.\d]|$)/.test(src)) {
    warn(`Vague version pin in CDN URL (major-only — future update could break): ${src}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE QUALITY
// ═══════════════════════════════════════════════════════════════════════════════

if (!scriptBlock) {
  warn('No inline <script> block found to syntax-check');
} else {
  try {
    new vm.Script(scriptBlock);
    pass('Inline <script> block has no syntax errors');
  } catch (e) {
    fail(`Inline <script> syntax error: ${e.message}`);
  }
}

// Optional: localStorage key consistency.
// Uncomment and populate CANONICAL_KEYS to enable per-app:
//
// const CANONICAL_KEYS = ['myapp_theme', 'myapp_settings'];
// const lsDirect  = [...scriptBlock.matchAll(/localStorage\.\w+\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
// const uniqueKeys = [...new Set(lsDirect)];
// const unknownKeys = uniqueKeys.filter(k => !CANONICAL_KEYS.includes(k));
// if (unknownKeys.length > 0) {
//   unknownKeys.forEach(k => warn(`Unexpected localStorage key: "${k}"`));
// } else if (uniqueKeys.length > 0) {
//   pass(`localStorage keys match canonical set (${uniqueKeys.join(', ')})`);
// }

// ═══════════════════════════════════════════════════════════════════════════════
// CSS HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

const definedVars = new Set([...cssBlock.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map(m => `--${m[1]}`));
const usedVars    = new Set([...cssBlock.matchAll(/var\(--([a-zA-Z0-9-]+)/g)].map(m => `--${m[1]}`));

// Vars set via JS inline styles (e.g. animation timing) — declare here per app to suppress warnings.
const DYNAMIC_VARS = new Set([]);

const undefinedVars = [...usedVars].filter(v => !definedVars.has(v) && !DYNAMIC_VARS.has(v));
if (undefinedVars.length === 0) {
  if (usedVars.size > 0) pass(`All CSS variables are defined (${usedVars.size} vars used, ${definedVars.size} defined)`);
} else {
  undefinedVars.forEach(v => warn(`CSS variable ${v} is used in var() but never defined`));
}

const themes = {};
for (const [, name, body] of cssBlock.matchAll(/html\[data-theme="([^"]+)"\]\s*\{([^}]+)\}/g)) {
  themes[name] = new Set([...body.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map(m => `--${m[1]}`));
}
const themeNames = Object.keys(themes);
if (themeNames.length >= 2) {
  const allThemeVars = new Set(themeNames.flatMap(t => [...themes[t]]));
  let complete = true;
  for (const varName of allThemeVars) {
    const missing = themeNames.filter(t => !themes[t].has(varName));
    if (missing.length > 0) {
      warn(`CSS var ${varName} missing from theme(s): ${missing.join(', ')}`);
      complete = false;
    }
  }
  if (complete) {
    pass(`All ${themeNames.length} themes define the same variable set (${allThemeVars.size} vars each)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HYGIENE
// ═══════════════════════════════════════════════════════════════════════════════

const consoleLogs = [...html.matchAll(/console\.log\s*\(/g)];
consoleLogs.length === 0
  ? pass('No console.log statements found')
  : warn(`${consoleLogs.length} console.log statement(s) left in`);

const localhostMatches = [...html.matchAll(/localhost:\d+/g)];
localhostMatches.length === 0
  ? pass('No localhost URLs in source')
  : localhostMatches.forEach(m => fail(`Hardcoded localhost URL: ${m[0]}`));

// ═══════════════════════════════════════════════════════════════════════════════
// PRINT RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

const divider = '─'.repeat(67);

const sections = [
  { title: 'Accessibility', filter: m => /label|button|title|lang|viewport/i.test(m) },
  { title: 'Performance',   filter: m => /\bKB\b|defer|async|preconnect hint|favicon.*files|icon.*files|icon.*present|files present/i.test(m) },
  { title: 'Integrity',     filter: m => /manifest\.json|CDN reachable|CDN returned|CDN unreachable|version pin/i.test(m) },
  { title: 'Code quality',  filter: m => /syntax|localStorage|script block/i.test(m) },
  { title: 'CSS health',    filter: m => /CSS var|CSS variable|All \d+ themes define|variable set/i.test(m) },
  { title: 'Hygiene',       filter: m => /console|localhost/i.test(m) },
];

console.log(`\n${divider}`);
console.log(`  ${APP_NAME} — Pre-deploy checks`);
console.log(divider);

for (const { title, filter } of sections) {
  const items = [
    ...results.fail.filter(filter),
    ...results.warn.filter(filter),
    ...results.pass.filter(filter),
  ];
  if (!items.length) continue;
  console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
  for (const item of items) {
    const symbol = results.fail.includes(item) ? '✗' : results.warn.includes(item) ? '⚠' : '✓';
    console.log(`  ${symbol}  ${item}`);
  }
}

const { fail: failures, warn: warnings, pass: passes } = results;
console.log(`\n${divider}`);
console.log(`  ${passes.length} passed  |  ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}  |  ${failures.length} failure${failures.length !== 1 ? 's' : ''}`);
if (failures.length > 0) console.log('  Deploy BLOCKED — fix failures above before deploying.');
console.log(divider);

if (CHECK_ONLY) process.exit(failures.length > 0 ? 1 : 0);

// ═══════════════════════════════════════════════════════════════════════════════
// DOCS UPDATES (skipped in --check-only mode)
// ═══════════════════════════════════════════════════════════════════════════════

if (failures.length > 0) process.exit(1);

const shortHash    = git('git rev-parse --short HEAD');
const fullHash     = git('git rev-parse HEAD');
const commitMsg    = git('git log -1 --pretty=%s');
const changedFiles = git('git diff-tree --no-commit-id -r --name-only HEAD').split('\n').filter(Boolean);
const now          = new Date();
const dateStr      = now.toISOString().split('T')[0];
const timeStr      = now.toTimeString().slice(0, 8);

if (exists('PROJECT.md')) {
  write('PROJECT.md', read('PROJECT.md').replace(
    /\*\*Last updated:\*\* .+/,
    `**Last updated:** ${dateStr} (${commitMsg})`
  ));
}

const LOG_HEADER = '> This file is maintained by Claude Code. Do not edit manually.\n\n# Deploy Log\n\n---\n\n';
const entry = [
  `## ${dateStr} ${timeStr}`, '',
  `- **Commit:** \`${shortHash}\` \`${fullHash}\``,
  `- **Message:** ${commitMsg}`,
  `- **Files changed:**`,
  ...changedFiles.map(f => `  - \`${f}\``),
  '', '---', '',
].join('\n');

if (!exists('DEPLOY_LOG.md')) {
  write('DEPLOY_LOG.md', LOG_HEADER + entry);
} else {
  const existing = read('DEPLOY_LOG.md');
  const anchor   = '# Deploy Log\n\n---\n\n';
  const idx      = existing.indexOf(anchor);
  write('DEPLOY_LOG.md',
    idx !== -1
      ? existing.slice(0, idx + anchor.length) + entry + existing.slice(idx + anchor.length)
      : existing + '\n' + entry
  );
}

const filesToStage = ['PROJECT.md', 'DEPLOY_LOG.md'].filter(f => exists(f));
if (filesToStage.length) {
  execSync(`git add ${filesToStage.join(' ')}`, { cwd: ROOT });
  try { execSync(`git commit -m "chore: pre-deploy docs update ${dateStr}"`, { cwd: ROOT, stdio: 'pipe' }); }
  catch { /* nothing to commit */ }
}

console.log(`\n${divider}`);
console.log('  Deploy summary');
console.log(divider);
console.log(`  Commit:   ${shortHash}  ${commitMsg}`);
if (changedFiles.length) {
  console.log(`  Changed (${changedFiles.length} file${changedFiles.length !== 1 ? 's' : ''}):`);
  changedFiles.forEach(f => console.log(`    ${f}`));
}
console.log(`${divider}\n`);

process.exit(0);
