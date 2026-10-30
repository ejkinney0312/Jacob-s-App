import { BATHROOM_EXPECTED_TOTAL, BATHROOM_FIXTURE } from '@/domain/fixtures/bathroom-fixture';

import { approveMission, listWaitingApprovals } from '../approvals';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission } from '../quest-flow';
import { listQuests } from '../quests';
import { insertQuest } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

const DATE = '2026-10-29';
const QUEST_INSTANCE = `bathroom:${DATE}`;
const NOW = new Date('2026-10-29T15:00:00Z');
const LATER = new Date('2026-10-29T18:00:00Z');

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await insertQuest(db, BATHROOM_FIXTURE);
  await ensureInstancesForDate(db, await listQuests(db), DATE);
});
afterEach(() => {
  db.close();
});

describe('the supplied Bathroom quest', () => {
  it('has 11 missions, 3 of them key missions', () => {
    expect(BATHROOM_FIXTURE.missions).toHaveLength(11);
    expect(BATHROOM_FIXTURE.missions.filter((m) => m.requiresApproval)).toHaveLength(3);
  });

  it('pays 95 XP, 38 emeralds and 1 block through the real completion and approval code', async () => {
    for (const mission of BATHROOM_FIXTURE.missions) {
      await completeMission(db, QUEST_INSTANCE, mission.id, NOW);
    }

    // The 8 ordinary missions have paid; the 3 key missions wait and the quest bonus is held back.
    expect(await getEarnedTotals(db)).toEqual({ xp: 40, emeralds: 16, blocks: 0 });
    const waiting = await listWaitingApprovals(db);
    expect(waiting).toHaveLength(3);

    for (const item of waiting) {
      await approveMission(db, item.missionInstanceId, LATER);
    }
    expect(await getEarnedTotals(db)).toEqual(BATHROOM_EXPECTED_TOTAL);

    // Approving again (double tap, retry) pays nothing more.
    for (const item of waiting) {
      await approveMission(db, item.missionInstanceId, LATER);
    }
    expect(await getEarnedTotals(db)).toEqual(BATHROOM_EXPECTED_TOTAL);
  });
});
