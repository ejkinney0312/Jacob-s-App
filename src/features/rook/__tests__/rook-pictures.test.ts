/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { ROOK_POSES } from '@/domain/rook';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path));

/** The RGBA pixels of an 8-bit PNG (not interlaced), so the test can look at the transparency. */
function decode(bytes: Buffer): { width: number; height: number; alphaAt: (x: number, y: number) => number } {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(bytes[24]).toBe(8); // bit depth
  expect(bytes[25]).toBe(6); // RGBA
  expect(bytes[28]).toBe(0); // not interlaced
  const chunks: Buffer[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT') chunks.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const left = i >= 4 ? out[y * stride + i - 4] : 0;
      const up = y > 0 ? out[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= 4 ? out[(y - 1) * stride + i - 4] : 0;
      let value: number;
      if (filter === 0) value = x;
      else if (filter === 1) value = x + left;
      else if (filter === 2) value = x + up;
      else if (filter === 3) value = x + ((left + up) >> 1);
      else {
        const p = left + up - upLeft;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        value = x + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      out[y * stride + i] = value & 255;
    }
  }
  return { width, height, alphaAt: (x, y) => out[y * stride + x * 4 + 3] };
}

describe("Rook's pictures", () => {
  it.each(ROOK_POSES)('%s is a square transparent PNG, not huge, with clear corners and a figure in the middle', (pose) => {
    const bytes = read(`assets/images/rook/rook-${pose}.png`);
    expect(bytes.toString('latin1', 1, 4)).toBe('PNG');
    expect(bytes.length).toBeLessThan(400_000);
    const { width, height, alphaAt } = decode(bytes);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(384);
    // Transparent corners mean no white box shows on the page behind Rook.
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]] as const) expect(alphaAt(x, y)).toBe(0);
    // The figure is solid in the middle and rests on the bottom line.
    expect(alphaAt(width >> 1, height >> 1)).toBe(255);
    expect(alphaAt(width >> 1, height - 1 - 40)).toBeGreaterThan(0);
  });

  it('all share one canvas size, so changing pose never makes Rook jump', () => {
    const sizes = ROOK_POSES.map((pose) => read(`assets/images/rook/rook-${pose}.png`).readUInt32BE(16));
    expect(new Set(sizes).size).toBe(1);
  });

  it('are the ones the app lists, one per pose, each pointing at its own file', () => {
    const source = readFileSync(join(ROOT, 'src/features/rook/rook-picture.tsx'), 'utf8');
    const listed = [...source.matchAll(/(\w+): require\('@\/assets\/images\/rook\/rook-(\w+)\.png'\)/g)];
    expect(listed.map((m) => m[1]).sort()).toEqual([...ROOK_POSES].sort());
    for (const [, pose, file] of listed) expect(file).toBe(pose);
  });

  it('are hidden from screen readers, since the name and the words say it all', () => {
    const source = readFileSync(join(ROOT, 'src/features/rook/rook-picture.tsx'), 'utf8');
    expect(source).toContain('accessibilityElementsHidden');
    expect(source).toContain('importantForAccessibility="no-hide-descendants"');
  });

  it('are used: lines pick a pose by kind, and finishing a quest shows the cheer', () => {
    const says = readFileSync(join(ROOT, 'src/features/rook/rook-says.tsx'), 'utf8');
    expect(says).toContain('poseForKind(line.kind)');
    expect(says).not.toContain('bird.fill'); // the old bird symbol is gone
    const celebration = readFileSync(join(ROOT, 'src/features/quest/celebration.tsx'), 'utf8');
    expect(celebration).toContain('pose="cheer"');
  });
});
