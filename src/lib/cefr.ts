export const CEFR_LABELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLabel = (typeof CEFR_LABELS)[number];

export function clampLevel(level: number): number {
  if (level < 1) return 1;
  if (level > 6) return 6;
  return level;
}

export function levelToLabel(level: number): CefrLabel {
  const index = Math.round(clampLevel(level)) - 1;
  return CEFR_LABELS[index] ?? 'A1';
}

export function labelToLevel(label: CefrLabel): number {
  return CEFR_LABELS.indexOf(label) + 1;
}
