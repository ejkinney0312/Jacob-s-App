/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../../..');
const AVATAR = 'assets/images/rook-avatar.png';

describe("Rook's picture", () => {
  const bytes = readFileSync(join(ROOT, AVATAR));

  it('is a square PNG, sharp enough for a 64-point circle on a 3x screen, and not huge', () => {
    expect(bytes.toString('latin1', 1, 4)).toBe('PNG');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(192);
    expect(width).toBeLessThanOrEqual(1024);
    expect(bytes.length).toBeLessThan(600_000);
  });

  it('is the picture the Rook card actually shows', () => {
    const source = readFileSync(join(ROOT, 'src/features/rook/rook-says.tsx'), 'utf8');
    expect(source).toContain(`require('@/${AVATAR}')`);
    // The old bird symbol is gone, so there is only one Rook.
    expect(source).not.toContain('bird.fill');
  });

  it('is hidden from screen readers, since the name and the words in the bubble say it all', () => {
    const source = readFileSync(join(ROOT, 'src/features/rook/rook-says.tsx'), 'utf8');
    expect(source).toMatch(/<Image[^>]*accessibilityElementsHidden/);
    expect(source).toMatch(/<Image[^>]*importantForAccessibility="no-hide-descendants"/);
  });
});
