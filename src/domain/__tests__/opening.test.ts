import { OPENING_BACKGROUND, OPENING_SETTLE_SCALE, OPENING_TIMING, openingDurationMs, openingMode } from '../opening';

describe('the opening', () => {
  it('is skipped when a screen reader is on, whatever else is set', () => {
    expect(openingMode(false, true)).toBe('skip');
    expect(openingMode(true, true)).toBe('skip');
  });

  it('is only the still picture when Reduce Motion is on', () => {
    expect(openingMode(true, false)).toBe('still');
  });

  it('is animated otherwise', () => {
    expect(openingMode(false, false)).toBe('animated');
  });

  it('is short, and nothing in it can flash', () => {
    expect(openingDurationMs('skip')).toBe(0);
    expect(openingDurationMs('still')).toBe(OPENING_TIMING.stillHoldMs);
    expect(openingDurationMs('animated')).toBe(OPENING_TIMING.settleMs + OPENING_TIMING.holdMs + OPENING_TIMING.fadeMs);
    for (const mode of ['still', 'animated'] as const) expect(openingDurationMs(mode)).toBeLessThan(2500);
    // Every movement and fade is slow (300 ms or more), so nothing can blink.
    expect(OPENING_TIMING.settleMs).toBeGreaterThanOrEqual(300);
    expect(OPENING_TIMING.fadeMs).toBeGreaterThanOrEqual(300);
  });

  it('only grows a little', () => {
    expect(OPENING_SETTLE_SCALE).toBeGreaterThan(1);
    expect(OPENING_SETTLE_SCALE).toBeLessThanOrEqual(1.2);
  });

  it('uses a plain color for its background', () => {
    expect(OPENING_BACKGROUND).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
