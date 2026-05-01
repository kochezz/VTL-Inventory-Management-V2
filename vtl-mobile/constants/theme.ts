import { ViewStyle } from 'react-native';

export const COLORS = {
  // Backgrounds — deep layered dark
  bg:          '#080F1A',   // Page background — deepest navy
  surface:     '#0F1C2E',   // Card surface
  surfaceAlt:  '#152337',   // Elevated card / input bg
  border:      '#1E3048',   // Subtle borders
  borderBright:'#2A4A6B',   // Active/hover borders

  // Brand
  sky:         '#0EA5E9',   // Primary accent — sky blue
  skyDim:      '#0369A1',   // Muted sky
  skyGlow:     'rgba(14,165,233,0.15)',

  teal:        '#0D9488',   // Secondary accent
  tealGlow:    'rgba(13,148,136,0.15)',

  // Status colours
  green:       '#10B981',
  greenGlow:   'rgba(16,185,129,0.15)',
  amber:       '#F59E0B',
  amberGlow:   'rgba(245,158,11,0.15)',
  red:         '#EF4444',
  redGlow:     'rgba(239,68,68,0.15)',
  purple:      '#8B5CF6',
  purpleGlow:  'rgba(139,92,246,0.15)',

  // Text
  textPrimary:   '#F0F6FF',
  textSecondary: '#7A9EC0',
  textMuted:     '#3D5A7A',

  // Chart palette
  chart: ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#0D9488'] as string[],

  // ── Backward-compat aliases (remove once all screens are upgraded) ──
  text:  '#F0F6FF',   // = textPrimary
  muted: '#3D5A7A',   // = textMuted
  navy:  '#0F2942',
  blue:  '#0EA5E9',   // previously #1565C0; mapped to sky for continuity
};

export const FONTS = {
  heading: undefined as string | undefined,
  mono:    'monospace',
};

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,

  glow: (color: string): ViewStyle => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  }),
};
