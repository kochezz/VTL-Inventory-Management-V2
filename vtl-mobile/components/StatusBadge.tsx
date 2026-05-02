import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

type ColorSet = { color: string; glow: string };

const MAP: Record<string, ColorSet> = {
  // Green
  RELEASED:   { color: COLORS.green,  glow: COLORS.greenGlow },
  COMPLETED:  { color: COLORS.green,  glow: COLORS.greenGlow },
  CLOSED:     { color: COLORS.green,  glow: COLORS.greenGlow },
  VERIFIED:   { color: COLORS.green,  glow: COLORS.greenGlow },
  PAID:       { color: COLORS.green,  glow: COLORS.greenGlow },
  DELIVERED:  { color: COLORS.green,  glow: COLORS.greenGlow },
  APPROVED:   { color: COLORS.green,  glow: COLORS.greenGlow },
  EFFECTIVE:  { color: COLORS.green,  glow: COLORS.greenGlow },

  // Sky
  REVIEW:         { color: COLORS.sky, glow: COLORS.skyGlow },
  PLANNED:        { color: COLORS.sky, glow: COLORS.skyGlow },
  IN_PROGRESS:    { color: COLORS.sky, glow: COLORS.skyGlow },
  PENDING:        { color: COLORS.sky, glow: COLORS.skyGlow },
  PROCESSING:     { color: COLORS.sky, glow: COLORS.skyGlow },
  RUNNING:        { color: COLORS.sky, glow: COLORS.skyGlow },
  SCHEDULED:      { color: COLORS.sky, glow: COLORS.skyGlow },
  READY_FOR_SETUP:{ color: COLORS.sky, glow: COLORS.skyGlow },

  // Amber
  DRAFT:            { color: COLORS.amber, glow: COLORS.amberGlow },
  OPEN:             { color: COLORS.amber, glow: COLORS.amberGlow },
  AWAITING_QA:      { color: COLORS.amber, glow: COLORS.amberGlow },
  SUBMITTED:        { color: COLORS.amber, glow: COLORS.amberGlow },
  CAPA_REQUIRED:    { color: COLORS.amber, glow: COLORS.amberGlow },
  PENDING_APPROVAL: { color: COLORS.amber, glow: COLORS.amberGlow },
  OVERDUE:          { color: COLORS.amber, glow: COLORS.amberGlow },

  // Red
  CRITICAL:   { color: COLORS.red, glow: COLORS.redGlow },
  ZERO_STOCK: { color: COLORS.red, glow: COLORS.redGlow },
  REJECTED:   { color: COLORS.red, glow: COLORS.redGlow },
  CANCELLED:  { color: COLORS.red, glow: COLORS.redGlow },
  VOID:       { color: COLORS.red, glow: COLORS.redGlow },
  FAILED:     { color: COLORS.red, glow: COLORS.redGlow },

  // Muted
  SUPERSEDED: { color: COLORS.textMuted, glow: COLORS.border },
  ARCHIVED:   { color: COLORS.textMuted, glow: COLORS.border },
  INACTIVE:   { color: COLORS.textMuted, glow: COLORS.border },
  ON_HOLD:    { color: COLORS.textMuted, glow: COLORS.border },
  SUSPENDED:  { color: COLORS.textMuted, glow: COLORS.border },
};

const DEFAULT: ColorSet = { color: COLORS.sky, glow: COLORS.skyGlow };

interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

export function StatusBadge({ status, small }: StatusBadgeProps) {
  const normalised = (status ?? '').toUpperCase();
  const { color, glow } = MAP[normalised] ?? DEFAULT;

  return (
    <View
      style={[
        s.pill,
        { backgroundColor: glow, borderColor: color },
        small && s.small,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: color,
          marginRight: 5,
          opacity: 0.9,
        }} />
        <Text
          style={[
            s.label,
            { color },
            small && s.labelSmall,
          ]}
        >
          {normalised.replace(/_/g, ' ')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 9,
  },
});
