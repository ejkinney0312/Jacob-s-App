/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { synthesizeChimeWav, SAMPLE_RATE } = require('../../../scripts/chime-synth') as {
  synthesizeChimeWav: () => Buffer;
  SAMPLE_RATE: number;
};

const FILE = join(__dirname, '../../../assets/sounds/quest-chime.wav');
const wav = readFileSync(FILE);
const FULL_SCALE = 32768;
const samples = Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + i * 2));
const seconds = (n: number) => Math.round(n * SAMPLE_RATE);

describe('quest chime asset', () => {
  it('is a plain mono 16-bit 44.1 kHz PCM WAV that every platform can play', () => {
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.toString('ascii', 36, 40)).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44); // header agrees with the file
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  });

  it('is short: one chime of a second or two', () => {
    const duration = samples.length / SAMPLE_RATE;
    expect(duration).toBeGreaterThanOrEqual(1);
    expect(duration).toBeLessThanOrEqual(2.5);
  });

  it('is soft: well below full scale, and never clips', () => {
    const peak = Math.max(...samples.map(Math.abs)) / FULL_SCALE;
    expect(peak).toBeGreaterThan(0.1); // audible
    expect(peak).toBeLessThanOrEqual(0.35); // gentle (about -9 dBFS)
    expect(samples.every((s) => s > -FULL_SCALE && s < FULL_SCALE - 1)).toBe(true);
  });

  it('starts and ends at silence, so there is no click', () => {
    expect(Math.abs(samples[0])).toBeLessThanOrEqual(2);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThanOrEqual(2);
  });

  it('never jumps abruptly between neighbouring samples (no clicks or pops)', () => {
    let biggestStep = 0;
    for (let i = 1; i < samples.length; i++) biggestStep = Math.max(biggestStep, Math.abs(samples[i] - samples[i - 1]));
    expect(biggestStep / FULL_SCALE).toBeLessThan(0.1);
  });

  it('is a single gentle chime that fades away, with no second burst and no flashing-like pulsing', () => {
    const window = seconds(0.1);
    const rms = (from: number) => {
      const slice = samples.slice(from, from + window);
      return Math.sqrt(slice.reduce((sum, s) => sum + s * s, 0) / Math.max(1, slice.length)) / FULL_SCALE;
    };
    const rmsByWindow = Array.from({ length: Math.floor(samples.length / window) }, (_, i) => rms(i * window));
    const loudest = rmsByWindow.indexOf(Math.max(...rmsByWindow));
    expect(loudest).toBeLessThanOrEqual(5); // the loudest moment is in the first half second
    // After the loudest moment the sound never gets louder than it was (apart from the second note joining in).
    const afterSecondNote = rmsByWindow.slice(5);
    afterSecondNote.slice(1).forEach((value, i) => expect(value).toBeLessThanOrEqual(afterSecondNote[i] * 1.02 + 1e-6));
    expect(rmsByWindow[rmsByWindow.length - 1]).toBeLessThan(0.01); // faded out
  });

  it('is exactly what scripts/chime-synth.js makes, so it cannot have been edited by hand', () => {
    expect(wav.equals(synthesizeChimeWav())).toBe(true);
  });

  it('is small enough to ship (under 200 KB)', () => {
    expect(wav.length).toBeLessThan(200 * 1024);
  });
});
