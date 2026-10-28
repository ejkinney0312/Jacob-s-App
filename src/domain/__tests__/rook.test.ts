import {
  GREETING_LINES,
  ROOK_NAME,
  lineAt,
  milestoneLine,
  missionLine,
  questIntroText,
  todayLines,
  type RookLine,
  type RookMilestones,
} from '../rook';

/** Words Rook must never use: failure, shaming, pressure, baby talk, boasting, comparison. */
const FORBIDDEN =
  /\b(fail(ed|ure|ing)?|wrong|mistake|bad|lazy|late|behind|slow|hurry|rush(ed)?\s+up|must|have to|need to|should|try harder|give up|disappoint(ed|ing)?|lose|lost|miss(ed)?|streak|only|just|yay|hooray|oopsie|uh[- ]oh|good (boy|girl)|champ|champion|winner|amazing|awesome|perfect|best)\b/i;
const NO_MILESTONES: RookMilestones = { levelReached: null, newBadges: 0, newVillageStages: 0 };

function expectKind(line: RookLine | null) {
  expect(line).not.toBeNull();
  const text = line!.text;
  expect(text).not.toMatch(/!/);
  expect(text).toMatch(/[.]$/);
  expect(text.length).toBeLessThanOrEqual(220); // short enough to listen to comfortably
  // "no rush" and "there is no rush" are reassurance, so allow that exact phrase.
  expect(text.replace(/no rush/gi, '')).not.toMatch(FORBIDDEN);
}

describe('Rook', () => {
  it('is called Rook', () => {
    expect(ROOK_NAME).toBe('Rook');
  });
});

describe('the placeholder greeting lines', () => {
  it('are demo content with stable unique ids', () => {
    expect(GREETING_LINES.length).toBeGreaterThanOrEqual(4);
    expect(GREETING_LINES.every((l) => l.id.startsWith('demo-') && l.kind === 'greeting')).toBe(true);
    expect(new Set(GREETING_LINES.map((l) => l.id)).size).toBe(GREETING_LINES.length);
  });

  it('are warm and adult: no exclamation marks, no pressure, failure, shaming or baby talk', () => {
    GREETING_LINES.forEach(expectKind);
  });

  it('never refer to missed days, streaks or comparison', () => {
    const all = GREETING_LINES.map((l) => l.text).join(' ');
    expect(all).not.toMatch(/\b(yesterday|last time|again today|every day|in a row|other people|everyone else)\b/i);
  });
});

describe('milestoneLine', () => {
  it('is null when nothing is new', () => {
    expect(milestoneLine(NO_MILESTONES)).toBeNull();
  });

  it('reacts to a level reached and says where to look', () => {
    const line = milestoneLine({ ...NO_MILESTONES, levelReached: 2 });
    expect(line?.text).toBe('You reached Level 2. You can see what changed on the Progress tab.');
    expectKind(line);
  });

  it('reacts to new badges, singular and plural', () => {
    expect(milestoneLine({ ...NO_MILESTONES, newBadges: 1 })?.text).toBe(
      'Earned a new badge. You can see what changed on the Progress tab.',
    );
    expect(milestoneLine({ ...NO_MILESTONES, newBadges: 3 })?.text).toBe(
      'Earned 3 new badges. You can see what changed on the Progress tab.',
    );
  });

  it('reacts to village growth and points to the Village tab', () => {
    expect(milestoneLine({ ...NO_MILESTONES, newVillageStages: 2 })?.text).toBe(
      'The village grew. You can see what changed on the Village tab.',
    );
  });

  it('puts everything new in one line, so nothing is hidden behind another tap', () => {
    const line = milestoneLine({ levelReached: 2, newBadges: 2, newVillageStages: 1 });
    expect(line?.text).toBe(
      'You reached Level 2, earned 2 new badges, and the village grew. You can see what changed on the Progress and Village tabs.',
    );
    expectKind(line);
    expect(line?.kind).toBe('milestone');
  });

  it('is always a calm, positive reaction', () => {
    const cases: RookMilestones[] = [
      { levelReached: 5, newBadges: 0, newVillageStages: 0 },
      { levelReached: null, newBadges: 1, newVillageStages: 1 },
      { levelReached: 3, newBadges: 4, newVillageStages: 3 },
    ];
    cases.forEach((c) => expectKind(milestoneLine(c)));
  });
});

describe('todayLines and lineAt', () => {
  it('start with the reaction when there is one, then the general lines', () => {
    const lines = todayLines({ ...NO_MILESTONES, newBadges: 1 });
    expect(lines[0].kind).toBe('milestone');
    expect(lines.slice(1)).toEqual([...GREETING_LINES]);
  });

  it('are just the general lines when nothing is new', () => {
    expect(todayLines(NO_MILESTONES)).toEqual([...GREETING_LINES]);
  });

  it('cycle forever, never running out, and handle odd indexes', () => {
    const lines = todayLines(NO_MILESTONES);
    expect(lineAt(lines, 0)).toBe(lines[0]);
    expect(lineAt(lines, lines.length)).toBe(lines[0]);
    expect(lineAt(lines, lines.length + 2)).toBe(lines[2]);
    expect(lineAt(lines, -1)).toBe(lines[lines.length - 1]);
    expect(lineAt(lines, 2.9)).toBe(lines[2]);
  });
});

describe('questIntroText and missionLine', () => {
  it('welcomes the player to a quest with its name and mission count', () => {
    expect(questIntroText('Demo: Tidy the Workshop', 3)).toBe(
      "Today's quest is Demo: Tidy the Workshop. It has 3 missions. Take them one at a time.",
    );
    expect(questIntroText('Demo: Quick Quest', 1)).toContain('It has 1 mission.');
  });

  it('gives the welcome and the tip together at the start of a quest', () => {
    const line = missionLine({ questTitle: 'Demo: Water the Garden', missionCount: 2, isStart: true, tip: 'Stop when it is about three quarters full.' });
    expect(line).toEqual({
      id: 'demo-intro-tip',
      kind: 'intro',
      text: "Today's quest is Demo: Water the Garden. It has 2 missions. Take them one at a time. A tip: Stop when it is about three quarters full.",
    });
    expectKind(line);
  });

  it('gives only the tip once the quest is under way', () => {
    const line = missionLine({ questTitle: 'Q', missionCount: 3, isStart: false, tip: 'Start with the big ones.' });
    expect(line).toEqual({ id: 'demo-tip', kind: 'tip', text: 'A tip: Start with the big ones.' });
  });

  it('gives only the welcome when a mission has no tip, and nothing when there is nothing to say', () => {
    expect(missionLine({ questTitle: 'Q', missionCount: 3, isStart: true, tip: '  ' })?.text).toBe(
      "Today's quest is Q. It has 3 missions. Take them one at a time.",
    );
    expect(missionLine({ questTitle: 'Q', missionCount: 3, isStart: false, tip: '' })).toBeNull();
  });

  it('says the same text it shows, so the audio always has a text alternative', () => {
    const line = missionLine({ questTitle: 'Q', missionCount: 1, isStart: true, tip: 'Go slowly.' });
    expect(typeof line?.text).toBe('string');
    expect(line?.text.length).toBeGreaterThan(0);
  });
});
