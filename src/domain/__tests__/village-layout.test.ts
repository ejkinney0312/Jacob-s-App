import { SCENE_MAX_SIZE, SCENE_MIN_SIZE, sceneItemSize } from '../village-layout';

describe('sceneItemSize', () => {
  it('shares the width between up to three structures', () => {
    expect(sceneItemSize(300, 3)).toBe(100);
    expect(sceneItemSize(300, 5)).toBe(100);
  });

  it('gives fewer structures more room, up to a limit', () => {
    expect(sceneItemSize(300, 2)).toBe(SCENE_MAX_SIZE);
    expect(sceneItemSize(300, 1)).toBe(SCENE_MAX_SIZE);
  });

  it('rounds down so a row never overflows', () => {
    expect(sceneItemSize(301, 3)).toBe(100);
    expect(sceneItemSize(299, 3)).toBe(99);
  });

  it('never goes below the smallest readable size', () => {
    expect(sceneItemSize(150, 3)).toBe(SCENE_MIN_SIZE);
  });

  it('uses the smallest size when the width or count is not usable', () => {
    expect(sceneItemSize(0, 3)).toBe(SCENE_MIN_SIZE);
    expect(sceneItemSize(-5, 3)).toBe(SCENE_MIN_SIZE);
    expect(sceneItemSize(Number.NaN, 3)).toBe(SCENE_MIN_SIZE);
    expect(sceneItemSize(300, 0)).toBe(SCENE_MIN_SIZE);
    expect(sceneItemSize(300, 2.5)).toBe(SCENE_MIN_SIZE);
  });
});
