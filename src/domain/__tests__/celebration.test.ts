import { CELEBRATION_TIMING, celebrationMode, describeCelebration } from '../celebration';

describe('celebrationMode', () => {
  it('is a still picture, with nothing moving, when Reduce Motion is on', () => {
    expect(celebrationMode(true)).toBe('still');
  });

  it('animates only when Reduce Motion is off', () => {
    expect(celebrationMode(false)).toBe('animated');
  });
});

describe('CELEBRATION_TIMING', () => {
  it('is a single smooth pass: every fade is slow, so nothing can flash or blink', () => {
    expect(CELEBRATION_TIMING.blockMs).toBeGreaterThanOrEqual(300);
    expect(CELEBRATION_TIMING.textMs).toBeGreaterThanOrEqual(300);
  });

  it('is over in well under three seconds', () => {
    const total = Math.max(
      CELEBRATION_TIMING.blockMs,
      CELEBRATION_TIMING.textDelayMs + CELEBRATION_TIMING.textMs,
    );
    expect(total).toBeLessThan(3000);
  });

  it('has no repeat count: it is not a loop', () => {
    expect(Object.keys(CELEBRATION_TIMING).sort()).toEqual(['blockMs', 'textDelayMs', 'textMs']);
  });
});

describe('describeCelebration', () => {
  it('names the bonus that was paid, in plain words', () => {
    const copy = describeCelebration({ xp: 10, emeralds: 4, blocks: 1 });
    expect(copy.headline).toBe('Quest finished');
    expect(copy.bonusLine).toBe('Bonus: 10 XP · 4 emeralds · 1 block');
    expect(copy.closing).toBe('Nice work.');
  });

  it('has no reward line, and still celebrates, when no bonus was paid', () => {
    const copy = describeCelebration({ xp: 0, emeralds: 0, blocks: 0 });
    expect(copy.bonusLine).toBeNull();
    expect(copy.headline).toBe('Quest finished');
    expect(copy.announcement).toBe('Quest finished. Nice work.');
  });

  it('gives screen readers the whole message once, including the bonus', () => {
    expect(describeCelebration({ xp: 10, emeralds: 4, blocks: 1 }).announcement).toBe(
      'Quest finished. Bonus: 10 XP · 4 emeralds · 1 block. Nice work.',
    );
  });

  it('is adult and warm: no childish, boastful or pressuring wording', () => {
    const all = Object.values(describeCelebration({ xp: 10, emeralds: 4, blocks: 1 })).join(' ');
    expect(all).not.toMatch(/\b(yay|hooray|amazing|awesome|super|wow|great job|good boy|good girl|perfect|champion|winner|streak|keep it up)\b/i);
    expect(all).not.toMatch(/!/);
  });
});
