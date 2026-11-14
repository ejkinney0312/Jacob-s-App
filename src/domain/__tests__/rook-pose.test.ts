import { poseForKind, ROOK_POSES, type RookLineKind } from '../rook';

const KINDS: RookLineKind[] = ['greeting', 'milestone', 'intro', 'tip'];

describe("Rook's poses", () => {
  it('has the five poses', () => {
    expect([...ROOK_POSES].sort()).toEqual(['cheer', 'idle', 'proud', 'thinking', 'wave']);
  });

  it('gives every kind of line a pose that fits it', () => {
    expect(poseForKind('greeting')).toBe('wave');
    expect(poseForKind('intro')).toBe('idle');
    expect(poseForKind('tip')).toBe('thinking');
    expect(poseForKind('milestone')).toBe('proud');
    for (const kind of KINDS) expect(ROOK_POSES).toContain(poseForKind(kind));
  });

  it('keeps the cheer for finishing a quest, so no line uses it', () => {
    for (const kind of KINDS) expect(poseForKind(kind)).not.toBe('cheer');
  });
});
