#!/usr/bin/env node
/**
 * Bumps admin-portal build number on every commit.
 * Optional semver bump when the commit message includes [major], [minor], or [patch]
 * (also accepts version: major|minor|patch).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionPath = path.join(__dirname, '..', 'version.json');

const messageFile = process.argv[2];
if (!messageFile) {
  console.error('bump-version: commit message file path required');
  process.exit(1);
}

const message = fs.readFileSync(messageFile, 'utf8').trim();
const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

data.build = Number(data.build ?? 0) + 1;

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
