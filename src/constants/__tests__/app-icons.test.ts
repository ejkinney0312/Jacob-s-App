/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OPENING_BACKGROUND, OPENING_BADGE_SIZE } from '@/domain/opening';

const ROOT = join(__dirname, '../../..');
const config = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')) as {
  expo: {
    icon: string;
    ios?: { icon?: string };
    android: { adaptiveIcon: { backgroundColor: string; foregroundImage: string; backgroundImage?: string; monochromeImage?: string } };
    plugins: unknown[];
  };
};

/** Width, height and color type from a PNG header (color type 2 is RGB, 6 is RGB with transparency). */
function png(path: string) {
  const bytes = readFileSync(join(ROOT, path));
  expect(bytes.toString('latin1', 1, 4)).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

const splash = (config.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, { image: string; imageWidth: number; backgroundColor: string }])[1];

describe('app icons and splash', () => {
  it('has a 1024 square iOS icon with no transparency (the App Store rejects it otherwise)', () => {
    const icon = png(config.expo.icon.replace('./', ''));
    expect(icon.width).toBe(1024);
    expect(icon.height).toBe(1024);
    expect([0, 2]).toContain(icon.colorType); // gray or RGB, no alpha channel
  });

  it('uses the plain icon on iOS, not a leftover layered one', () => {
    expect(config.expo.ios?.icon).toBeUndefined();
  });

  it('has a 1024 square Android foreground with transparency, on a plain background color', () => {
    const foreground = png(config.expo.android.adaptiveIcon.foregroundImage.replace('./', ''));
    expect(foreground.width).toBe(1024);
    expect(foreground.height).toBe(1024);
    expect(foreground.colorType).toBe(6);
    expect(config.expo.android.adaptiveIcon.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('does not point at old placeholder images', () => {
    expect(config.expo.android.adaptiveIcon.backgroundImage).toBeUndefined();
    expect(config.expo.android.adaptiveIcon.monochromeImage).toBeUndefined();
  });

  it('has a square splash picture with transparent corners', () => {
    const image = png(splash.image.replace('./', ''));
    expect(image.width).toBe(image.height);
    expect(image.width).toBeGreaterThanOrEqual(600); // sharp at three times the width it is shown
    expect(image.colorType).toBe(6);
  });

  it('matches the splash to the in-app opening, so nothing jumps', () => {
    expect(splash.backgroundColor.toLowerCase()).toBe(OPENING_BACKGROUND.toLowerCase());
    expect(splash.imageWidth).toBe(OPENING_BADGE_SIZE);
    expect(config.expo.android.adaptiveIcon.backgroundColor.toLowerCase()).toBe(OPENING_BACKGROUND.toLowerCase());
  });

  it('only refers to image files that exist', () => {
    const paths = JSON.stringify(config).match(/\.\/assets\/[^"]+/g) ?? [];
    expect(paths.length).toBeGreaterThan(3);
    for (const path of paths) expect(existsSync(join(ROOT, path))).toBe(true);
  });
});
