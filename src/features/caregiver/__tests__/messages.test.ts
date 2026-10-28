import { describeAnotherTryResult, describeApprovalResult, describeGuessFailure, formatClockTime } from '../messages';

// 2026-10-27 19:42:00 in UTC; compared in UTC so the test does not depend on where it runs.
const AT = Date.UTC(2026, 9, 27, 19, 42, 0);
const inUtc = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

describe('formatClockTime', () => {
  it('shows a fixed clock time, not a countdown', () => {
    expect(formatClockTime(AT, 'en-US')).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
    expect(inUtc(AT)).toBe('7:42 PM');
  });

  it('rounds up to the next whole minute, so a short wait never shows the current minute', () => {
    const at = (seconds: number) => formatClockTime(AT + seconds * 1000, 'en-US');
    const sameMinute = (a: string, b: string) => a === b;
    expect(sameMinute(at(0), formatClockTime(AT, 'en-US'))).toBe(true); // exactly on a minute: unchanged
    expect(at(1)).toBe(formatClockTime(AT + 60_000, 'en-US')); // 7:42:01 shows 7:43
    expect(at(59)).toBe(formatClockTime(AT + 60_000, 'en-US'));
    expect(at(60)).toBe(formatClockTime(AT + 60_000, 'en-US'));
    expect(at(61)).toBe(formatClockTime(AT + 120_000, 'en-US'));
  });
});

describe('describeGuessFailure', () => {
  const time = formatClockTime(AT, 'en-US');

  it('says how many tries are left, in the singular and plural', () => {
    expect(describeGuessFailure({ ok: false, reason: 'wrong', attemptsBeforeWait: 4, lockedUntil: null }, 'en-US')).toBe(
      "That didn't match. 4 tries left before a short wait.",
    );
    expect(describeGuessFailure({ ok: false, reason: 'wrong', attemptsBeforeWait: 1, lockedUntil: null }, 'en-US')).toBe(
      "That didn't match. 1 try left before a short wait.",
    );
  });

  it('gives a time to try again, not a ticking countdown', () => {
    const locked = describeGuessFailure({ ok: false, reason: 'locked', until: AT }, 'en-US');
    const justLocked = describeGuessFailure(
      { ok: false, reason: 'wrong', attemptsBeforeWait: 0, lockedUntil: AT },
      'en-US',
    );

    expect(locked).toBe(`Too many tries for now. You can try again at ${time}.`);
    expect(justLocked).toBe(`That didn't match. Please wait until ${time} to try again.`);
    for (const text of [locked, justLocked]) expect(text).not.toMatch(/\b\d+\s*(seconds?|minutes?|secs?|mins?)\b/i);
  });

  it('covers a missing or unreadable PIN', () => {
    expect(describeGuessFailure({ ok: false, reason: 'notSet' })).toBe('Nothing is set up yet.');
    expect(describeGuessFailure({ ok: false, reason: 'damaged' })).toBe("The saved PIN couldn't be read.");
  });

  it('never shames or blames', () => {
    const all = [
      describeGuessFailure({ ok: false, reason: 'wrong', attemptsBeforeWait: 3, lockedUntil: null }),
      describeGuessFailure({ ok: false, reason: 'locked', until: AT }),
      describeGuessFailure({ ok: false, reason: 'notSet' }),
      describeGuessFailure({ ok: false, reason: 'damaged' }),
    ].join(' ');
    expect(all).not.toMatch(/\b(wrong|fail(ed|ure)?|denied|invalid|incorrect|stupid|attack|suspicious|intruder)\b/i);
  });
});

describe('approval messages', () => {
  const paid = { xp: 5, emeralds: 2, blocks: 0 };
  const none = { xp: 0, emeralds: 0, blocks: 0 };

  it('says what was added when a mission is approved', () => {
    expect(describeApprovalResult({ outcome: 'approved', paid, bonus: none, questCompleted: false })).toBe(
      'Approved. 5 XP · 2 emeralds · 0 blocks added.',
    );
  });

  it('also says so when approving finishes the quest and pays the bonus', () => {
    expect(
      describeApprovalResult({
        outcome: 'approved',
        paid,
        bonus: { xp: 10, emeralds: 4, blocks: 1 },
        questCompleted: true,
      }),
    ).toBe('Approved. 5 XP · 2 emeralds · 0 blocks added. The quest is finished too: 10 XP · 4 emeralds · 1 block added.');
  });

  it('is clear when there was nothing to do', () => {
    expect(describeApprovalResult({ outcome: 'alreadyHandled', paid: none, bonus: none, questCompleted: false })).toBe(
      'That one was already approved.',
    );
    expect(describeApprovalResult({ outcome: 'notWaiting', paid: none, bonus: none, questCompleted: false })).toBe(
      "That mission isn't waiting for approval any more.",
    );
  });

  it('reassures the caregiver that asking for another try takes nothing away', () => {
    expect(describeAnotherTryResult({ outcome: 'requested' })).toBe('Asked for another try. Nothing was taken away.');
    expect(describeAnotherTryResult({ outcome: 'alreadyHandled' })).toMatch(/already approved/);
    expect(describeAnotherTryResult({ outcome: 'notWaiting' })).toMatch(/isn't waiting/);
  });

  it('never uses shaming or punishing words', () => {
    const all = [
      describeApprovalResult({ outcome: 'approved', paid, bonus: none, questCompleted: false }),
      describeApprovalResult({ outcome: 'alreadyHandled', paid: none, bonus: none, questCompleted: false }),
      describeAnotherTryResult({ outcome: 'requested' }),
      describeAnotherTryResult({ outcome: 'alreadyHandled' }),
    ].join(' ');
    expect(all).not.toMatch(/\b(reject(ed)?|denied|fail(ed|ure)?|wrong|penalt(y|ies)|deduct(ed)?|lost|removed)\b/i);
  });
});
