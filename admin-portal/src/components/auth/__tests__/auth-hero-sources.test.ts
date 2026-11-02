import fs from 'fs';
import path from 'path';

// Regression guard: these Unsplash photos were removed upstream and caused console 404s on login.
const DEAD = ['photo-1572891086295-6c65f5352b0f', 'photo-1580121441575-41bcb5c42b37'];

describe('auth hero image sources', () => {
  it('does not reference known-dead images', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'auth-hero.tsx'), 'utf8');
    for (const id of DEAD) expect(src).not.toContain(id);
  });
});
