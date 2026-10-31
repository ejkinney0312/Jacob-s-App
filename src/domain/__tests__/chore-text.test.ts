import { MAX_CHORE_TEXT, MAX_CHORE_TITLE, checkMissionText, checkQuestTitle, describeChoreTextProblem, type ChoreTextProblem } from '../chore-text';
import { MAX_TEXT, MAX_TITLE } from '../content-pack';

const good = { title: 'Wipe the sink', instruction: 'Wipe the sink with the cloth.', tip: 'Start at the back.' };

describe('chore text limits', () => {
  it('are the same limits a content pack uses', () => {
    expect(MAX_CHORE_TITLE).toBe(MAX_TITLE);
    expect(MAX_CHORE_TEXT).toBe(MAX_TEXT);
  });
});

describe('a quest title', () => {
  it('is trimmed', () => {
    expect(checkQuestTitle('  Bathroom  ')).toEqual({ ok: true, title: 'Bathroom' });
  });
  it.each([
    ['', 'titleEmpty'],
    ['   ', 'titleEmpty'],
    ['a'.repeat(MAX_CHORE_TITLE + 1), 'titleTooLong'],
    ['line\nbreak', 'badCharacters'],
    ['tab\there', 'badCharacters'],
  ] as const)('rejects %j', (title, problem) => {
    expect(checkQuestTitle(title)).toEqual({ ok: false, problem });
  });
  it('accepts exactly the longest allowed title', () => {
    expect(checkQuestTitle('a'.repeat(MAX_CHORE_TITLE)).ok).toBe(true);
  });
});

describe('a mission', () => {
  it('is trimmed, and a tip may be empty', () => {
    expect(checkMissionText({ title: ' A ', instruction: ' Do it. ', tip: '  ' })).toEqual({
      ok: true,
      text: { title: 'A', instruction: 'Do it.', tip: '' },
    });
  });
  it.each([
    [{ ...good, title: '' }, 'titleEmpty'],
    [{ ...good, instruction: '  ' }, 'instructionEmpty'],
    [{ ...good, instruction: 'a'.repeat(MAX_CHORE_TEXT + 1) }, 'instructionTooLong'],
    [{ ...good, tip: 'a'.repeat(MAX_CHORE_TEXT + 1) }, 'tipTooLong'],
    [{ ...good, instruction: 'bell\u0007' }, 'badCharacters'],
    [{ ...good, tip: 'null\u0000' }, 'badCharacters'],
  ] as const)('rejects %#', (text, problem) => {
    expect(checkMissionText(text)).toEqual({ ok: false, problem });
  });
  it('accepts the longest allowed instruction and tip', () => {
    expect(checkMissionText({ ...good, instruction: 'a'.repeat(MAX_CHORE_TEXT), tip: 'b'.repeat(MAX_CHORE_TEXT) }).ok).toBe(true);
  });
});

describe('wording for a problem', () => {
  it('is calm, plain and never blames', () => {
    const problems: ChoreTextProblem[] = ['titleEmpty', 'titleTooLong', 'instructionEmpty', 'instructionTooLong', 'tipTooLong', 'badCharacters'];
    const all = problems.map(describeChoreTextProblem);
    expect(all.every((t) => t.length > 0 && t.length < 80)).toBe(true);
    expect(all.join(' ')).not.toMatch(/\b(invalid|error|wrong|fail|failed|must|illegal)\b/i);
    expect(all.join(' ')).not.toMatch(/!/);
  });
});
