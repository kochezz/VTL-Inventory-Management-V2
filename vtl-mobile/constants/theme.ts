import { ViewStyle } from 'react-native';

export const COLORS = {
  bg:           '#080F1A',
  surface:      '#0F1C2E',
  surfaceAlt:   '#152337',
  border:       '#1E3048',
  borderBright: '#2A4A6B',

  sky:      '#0EA5E9',
  skyDim:   '#0369A1',
  skyGlow:  'rgba(14,165,233,0.15)',

  teal:     '#0D9488',
  tealGlow: 'rgba(13,148,136,0.15)',

  green:     '#10B981',
  greenGlow: 'rgba(16,185,129,0.15)',
  amber:     '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  red:       '#EF4444',
  redGlow:   'rgba(239,68,68,0.15)',
  purple:    '#8B5CF6',
  purpleGlow:'rgba(139,92,246,0.15)',

  textPrimary:   '#F0F6FF',
  textSecondary: '#7A9EC0',
  textMuted:     '#3D5A7A',

  chart: ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#0D9488'] as string[],

  // ── Backward-compat aliases ──────────────────────────────────────────────────
  text:  '#F0F6FF',
  muted: '#3D5A7A',
  navy:  '#0F2942',
  blue:  '#0EA5E9',
};

export const FONTS = {
  heading: undefined as string | undefined,
  mono:    'monospace',
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const SHADOW = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius:  12,
    elevation:     8,
  } as ViewStyle,

  glow: (color: string): ViewStyle => ({
    shadowColor:   color,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius:  12,
    elevation:     6,
  }),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(value: number, prefix = '$'): string {
  return (
    prefix +
    value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export const zebraRow = (index: number): object => ({
  backgroundColor: index % 2 === 0
    ? COLORS.surface
    : COLORS.surfaceAlt,
});
