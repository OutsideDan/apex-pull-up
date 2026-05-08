#!/usr/bin/env node
/**
 * make-icons.js
 * Converts icon-source.svg into all PNG sizes needed for favicons
 * and "Add to Home Screen" on iOS and Android.
 *
 * Usage: npm run icons
 * Requires: npm install (installs sharp)
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE = resolve(ROOT, 'icon-source.svg');

if (!existsSync(SOURCE)) {
  console.error('✗  icon-source.svg not found in project root');
  process.exit(1);
}

const sizes = [
  { file: 'favicon-16x16.png',    size: 16  },
  { file: 'favicon-32x32.png',    size: 32  },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png',         size: 192 },
  { file: 'icon-512.png',         size: 512 },
];

console.log('\nGenerating icons from icon-source.svg...\n');

for (const { file, size } of sizes) {
  await sharp(SOURCE, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(resolve(ROOT, file));
  console.log(`  ✓  ${file.padEnd(22)} ${size}×${size}px`);
}

console.log('\nDone. All icon files written to project root.\n');
