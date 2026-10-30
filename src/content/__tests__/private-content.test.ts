import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseContentPack } from '@/domain/content-pack';
import { BATHROOM_EXPECTED_TOTAL } from '@/domain/fixtures/bathroom-fixture';

import { loadPrivatePack } from '../private-pack';

const ROOT = join(__dirname, '..', '..', '..');
const PRIVATE_FILE = join(ROOT, 'content', 'private', 'household.json');
const hasPrivateFile = existsSync(PRIVATE_FILE);

describe('private household content', () => {
  it('is ignored by git, so it cannot be committed by accident', () => {
    const lines = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    expect(lines).toContain('/content/private/');
  });

  it('loads as nothing when this machine has no private file', () => {
    if (hasPrivateFile) return;
    expect(loadPrivatePack()).toBeNull();
  });

  // These two only run where the file exists (the household's own machine). They catch a bad edit
  // before a build. Failures name fields, never the household's wording.
  (hasPrivateFile ? it : it.skip)('is a valid content pack', () => {
    const result = parseContentPack(loadPrivatePack());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  (hasPrivateFile ? it : it.skip)('has a Bathroom quest that totals 95 XP, 38 emeralds and 1 block', () => {
    const result = parseContentPack(loadPrivatePack());
    if (!result.ok) throw new Error('the private file is not valid');
    const bathroom = result.pack.quests.find((q) => q.id === 'bathroom');
    expect(bathroom).toBeDefined();
    const total = bathroom!.missions.reduce(
      (sum, m) => ({ xp: sum.xp + m.reward.xp, emeralds: sum.emeralds + m.reward.emeralds, blocks: sum.blocks + m.reward.blocks }),
      { ...bathroom!.completionBonus },
    );
    expect(total).toEqual(BATHROOM_EXPECTED_TOTAL);
  });
});
