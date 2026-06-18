#!/usr/bin/env node
/**
 * Bumps admin-portal build number on every commit.
 * Optional semver bump when the commit message includes [major], [minor], or [patch]
 * (also accepts version: major|minor|patch).
 *
 * Usage:
 *   bump-version.mjs <commit-message-file>           # increment build + optional semver
 *   bump-version.mjs --semver-only <commit-message-file>  # semver only (no build++)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionPath = path.join(__dirname, '..', 'version.json');

const args = process.argv.slice(2);
const semverOnly = args[0] === '--semver-only';
const messageFile = semverOnly ? args[1] : args[0];

if (!messageFile) {
  console.error('bump-version: commit message file path required');
  process.exit(1);
}

const message = fs.readFileSync(messageFile, 'utf8').trim();
const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

const hasSemverMarker =
  /\[major\]|version:\s*major\b|\+major\b/i.test(message) ||
  /\[minor\]|version:\s*minor\b|\+minor\b/i.test(message) ||
  /\[patch\]|version:\s*patch\b|\+patch\b/i.test(message);

if (semverOnly && !hasSemverMarker) {
  process.exit(0);
}

if (!semverOnly) {
  data.build = Number(data.build ?? 0) + 1;
}

const [major, minor, patch] = String(data.semver ?? '1.0.0').split('.').map(Number);

if (/\[major\]|version:\s*major\b|\+major\b/i.test(message)) {
  data.semver = `${major + 1}.0.0`;
} else if (/\[minor\]|version:\s*minor\b|\+minor\b/i.test(message)) {
  data.semver = `${major}.${minor + 1}.0`;
} else if (/\[patch\]|version:\s*patch\b|\+patch\b/i.test(message)) {
  data.semver = `${major}.${minor}.${patch + 1}`;
}

fs.writeFileSync(versionPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`App version: ${data.semver}-${data.build}`);
