import { describe, expect, it } from 'vitest';
import { CEFR_LABELS, clampLevel, labelToLevel, levelToLabel } from './cefr';

describe('cefr helpers', () => {
  it('maps numeric levels to labels', () => {
    expect(levelToLabel(1)).toBe('A1');
    expect(levelToLabel(3)).toBe('B1');
    expect(levelToLabel(6)).toBe('C2');
  });

  it('rounds fractional levels to the nearest label', () => {
    expect(levelToLabel(3.4)).toBe('B1');
    expect(levelToLabel(3.6)).toBe('B2');
  });

  it('clamps fractional levels below 1 and above 6 for labels', () => {
    expect(levelToLabel(0.2)).toBe('A1');
    expect(levelToLabel(9)).toBe('C2');
  });

  it('maps labels back to numeric levels', () => {
    expect(labelToLevel('A1')).toBe(1);
    expect(labelToLevel('C2')).toBe(6);
  });

  it('clamps a level into the 1..6 range', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(7)).toBe(6);
    expect(clampLevel(4)).toBe(4);
  });

  it('exposes the ordered list of labels', () => {
    expect(CEFR_LABELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});
