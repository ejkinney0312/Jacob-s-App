/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { STARTER_PACK } from '../starter-content';
import { clipIdFor, RECORDED_TEXT } from '../voice-clips';

const starterMissions = STARTER_PACK.quests.flatMap((quest) => quest.missions);
const VOICES = join(__dirname, '../../../assets/voices');

describe('recorded voice clips', () => {
  it('say exactly what each starter chore says, with none missing and none extra', () => {
    expect(Object.keys(RECORDED_TEXT).sort()).toEqual(starterMissions.map((m) => m.id).sort());
    for (const mission of starterMissions) expect(RECORDED_TEXT[mission.id]).toBe(mission.instruction);
  });

  it('exist as real MP3 files in the project, one per starter chore', () => {
    for (const id of Object.keys(RECORDED_TEXT)) {
      const file = join(VOICES, `${id}.mp3`);
      expect(existsSync(file)).toBe(true);
      const bytes = readFileSync(file);
      // An MP3 starts with an ID3 tag or a frame sync (11 set bits); a stray text or empty file would not.
      const looksLikeMp3 = bytes.toString('latin1', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      expect(looksLikeMp3).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(5_000); // not an empty or cut-off file
      expect(statSync(file).size).toBeLessThan(500_000); // a short line, not a long recording
    }
  });

  it('lists the same clips in the app as were recorded', () => {
    const source = readFileSync(join(__dirname, '../../services/voice-clips.ts'), 'utf8');
    const listed = [...source.matchAll(/'(starter-[a-z]+-\d+)': require\('@\/assets\/voices\/([^']+)\.mp3'\)/g)];
    expect(listed.map((m) => m[1]).sort()).toEqual(Object.keys(RECORDED_TEXT).sort());
    for (const [, id, file] of listed) expect(file).toBe(id); // each id points at its own file
  });
});

describe('when a clip is used', () => {
  const mission = starterMissions[0];

  it('uses the clip while the words are unchanged', () => {
    expect(clipIdFor(mission)).toBe(mission.id);
  });

  it('uses the phone voice once a caregiver rewords the chore', () => {
    expect(clipIdFor({ id: mission.id, instruction: `${mission.instruction} Then wash your hands.` })).toBeNull();
    expect(clipIdFor({ id: mission.id, instruction: mission.instruction.toLowerCase() })).toBeNull();
  });

  it('has no clip for a chore that was never recorded, including one added in the app', () => {
    expect(clipIdFor({ id: 'starter-bathroom-added-1', instruction: mission.instruction })).toBeNull();
    expect(clipIdFor({ id: 'household-bathroom-1', instruction: mission.instruction })).toBeNull();
    expect(clipIdFor({ id: 'toString', instruction: 'x' })).toBeNull();
    expect(clipIdFor({ id: '__proto__', instruction: 'x' })).toBeNull();
  });
});
