export const COLORS = {
  // Brand
  navy:    '#0F2942',
  blue:    '#1565C0',
  sky:     '#0EA5E9',
  teal:    '#0D9488',
  green:   '#16A34A',
  amber:   '#D97706',
  red:     '#DC2626',

  // Surfaces
  bg:      '#0F172A',
  surface: '#1E293B',
  border:  '#334155',

  // Text
  text:    '#F1F5F9',
  muted:   '#94A3B8',
} as const;

export type ColorKey = keyof typeof COLORS;
