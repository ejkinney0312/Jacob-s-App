// Usage: node scripts/generate-chime.js   (rewrites assets/sounds/quest-chime.wav)
const fs = require('node:fs');
const path = require('node:path');

const { synthesizeChimeWav } = require('./chime-synth');

const target = path.join(__dirname, '..', 'assets', 'sounds', 'quest-chime.wav');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, synthesizeChimeWav());
console.log(`Wrote ${target}`);
