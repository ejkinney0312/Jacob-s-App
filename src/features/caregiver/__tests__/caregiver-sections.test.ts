import { CAREGIVER_SECTIONS } from '../caregiver-sections';

describe('caregiver sections', () => {
  it('lists every page once, with metrics last', () => {
    const ids = CAREGIVER_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['quests', 'reminders', 'routines', 'events', 'rewards', 'metrics']);
  });

  it('gives each tile a title and a one-line summary a screen reader can read', () => {
    for (const section of CAREGIVER_SECTIONS) {
      expect(section.title.trim()).not.toBe('');
      expect(section.summary.trim()).not.toBe('');
      expect(section.summary).not.toMatch(/[.!?]$/); // a short label, not a sentence
    }
  });

  it('has an icon for every platform', () => {
    for (const { symbol } of CAREGIVER_SECTIONS) {
      expect(symbol).toEqual({ ios: expect.any(String), android: expect.any(String), web: expect.any(String) });
    }
  });
});
