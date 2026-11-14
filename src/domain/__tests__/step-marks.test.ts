import { MAX_STEP_MARKS, stepMarks } from '../step-marks';

describe('stepMarks', () => {
  it('marks finished, current and upcoming missions', () => {
    expect(stepMarks(3, 5)).toEqual(['done', 'done', 'current', 'next', 'next']);
  });

  it('starts with the first mission current and nothing done', () => {
    expect(stepMarks(1, 3)).toEqual(['current', 'next', 'next']);
  });

  it('ends with every earlier mission done', () => {
    expect(stepMarks(4, 4)).toEqual(['done', 'done', 'done', 'current']);
  });

  it('draws a single mission', () => {
    expect(stepMarks(1, 1)).toEqual(['current']);
  });

  it('draws the longest quest it can, and nothing for a longer one', () => {
    expect(stepMarks(1, MAX_STEP_MARKS)).toHaveLength(MAX_STEP_MARKS);
    expect(stepMarks(1, MAX_STEP_MARKS + 1)).toEqual([]);
  });

  it('draws nothing when the numbers make no sense', () => {
    expect(stepMarks(0, 3)).toEqual([]);
    expect(stepMarks(4, 3)).toEqual([]);
    expect(stepMarks(1, 0)).toEqual([]);
    expect(stepMarks(1.5, 3)).toEqual([]);
    expect(stepMarks(1, 2.5)).toEqual([]);
    expect(stepMarks(Number.NaN, 3)).toEqual([]);
  });
});
