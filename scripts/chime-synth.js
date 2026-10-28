/**
 * Synthesizes the quest-completion chime: two soft bell-like notes (C5, then G5) from sine waves with a
 * gentle attack and a smooth decay, mono 16-bit 44.1 kHz. Original sound, made from plain math, no samples.
 * Deterministic, so `assets/sounds/quest-chime.wav` can be regenerated and compared byte for byte.
 */
const SAMPLE_RATE = 44100;
const DURATION_S = 1.6;
const PEAK = 0.3; // fraction of full scale (about -10 dBFS): soft
const ATTACK_S = 0.03;
const TAIL_FADE_S = 0.08; // final cosine fade so the file ends at exactly zero

// start time (s), frequency (Hz), decay time constant (s), relative level
const NOTES = [
  { start: 0.0, freq: 523.25, decay: 0.38, level: 1.0 },
  { start: 0.2, freq: 783.99, decay: 0.5, level: 0.85 },
];
// a little brightness: fundamental plus a quiet 2nd and 3rd partial
const PARTIALS = [
  { ratio: 1, level: 1 },
  { ratio: 2, level: 0.18 },
  { ratio: 3, level: 0.06 },
];

function synthesizeSamples() {
  const total = Math.round(SAMPLE_RATE * DURATION_S);
  const raw = new Float64Array(total);

  for (const note of NOTES) {
    for (let i = Math.round(note.start * SAMPLE_RATE); i < total; i++) {
      const t = i / SAMPLE_RATE - note.start;
      const attack = Math.min(1, t / ATTACK_S);
      const smoothAttack = 0.5 - 0.5 * Math.cos(Math.PI * attack); // no click at the start
      const envelope = smoothAttack * Math.exp(-t / note.decay);
      let tone = 0;
      for (const p of PARTIALS) tone += p.level * Math.sin(2 * Math.PI * note.freq * p.ratio * t);
      raw[i] += note.level * envelope * tone;
    }
  }

  const fadeStart = total - Math.round(TAIL_FADE_S * SAMPLE_RATE);
  for (let i = fadeStart; i < total; i++) {
    const progress = (i - fadeStart) / (total - fadeStart);
    raw[i] *= 0.5 + 0.5 * Math.cos(Math.PI * progress);
  }
  raw[total - 1] = 0;

  let max = 0;
  for (const v of raw) max = Math.max(max, Math.abs(v));
  const scale = (PEAK * 32767) / max;
  return Int16Array.from(raw, (v) => Math.round(v * scale));
}

function synthesizeChimeWav() {
  const samples = synthesizeSamples();
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  samples.forEach((s, i) => buffer.writeInt16LE(s, 44 + i * 2));
  return buffer;
}

module.exports = { synthesizeChimeWav, SAMPLE_RATE };
