import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

const STATUS_MAP: Record<string, { border: string; text: string }> = {
  // Green — success/complete
  RELEASED:          { border: COLORS.green,  text: COLORS.green },
  COMPLETED:         { border: COLORS.green,  text: COLORS.green },
  CLOSED:            { border: COLORS.green,  text: COLORS.green },
  VERIFIED:          { border: COLORS.green,  text: COLORS.green },
  APPROVED:          { border: COLORS.green,  text: COLORS.green },
  EFFECTIVE:         { border: COLORS.green,  text: COLORS.green },

  // Sky — active/in-progress
  REVIEW:            { border: COLORS.sky,    text: COLORS.sky },
  PLANNED:           { border: COLORS.sky,    text: COLORS.sky },
  IN_PROGRESS:       { border: COLORS.sky,    text: COLORS.sky },
  in_progress:       { border: COLORS.sky,    text: COLORS.sky },
  ready_for_setup:   { border: COLORS.sky,    text: COLORS.sky },
  RUNNING:           { border: COLORS.sky,    text: COLORS.sky },
  SCHEDULED:         { border: COLORS.sky,    text: COLORS.sky },

  // Amber — pending/draft/warning
  DRAFT:             { border: COLORS.amber,  text: COLORS.amber },
  OPEN:              { border: COLORS.amber,  text: COLORS.amber },
  CAPA_REQUIRED:     { border: COLORS.amber,  text: COLORS.amber },
  PENDING_APPROVAL:  { border: COLORS.amber,  text: COLORS.amber },
  OVERDUE:           { border: COLORS.amber,  text: COLORS.amber },

  // Red — critical/error
  CRITICAL:          { border: COLORS.red,    text: COLORS.red },
  ZERO_STOCK:        { border: COLORS.red,    text: COLORS.red },
  rejected:          { border: COLORS.red,    text: COLORS.red },
  REJECTED:          { border: COLORS.red,    text: COLORS.red },
  FAILED:            { border: COLORS.red,    text: COLORS.red },

  // Purple — misc
  ON_HOLD:           { border: COLORS.purple, text: COLORS.purple },
  SUSPENDED:         { border: COLORS.purple, text: COLORS.purple },
};

const DEFAULT: { border: string; text: string } = {
  border: COLORS.borderBright,
  text:   COLORS.textSecondary,
};

interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

export function StatusBadge({ status, small }: StatusBadgeProps) {
  const style = STATUS_MAP[status] ?? DEFAULT;
  return (
    <View
      style={[
        s.pill,
        { borderColor: style.border },
        small && s.small,
      ]}
    >
      <Text
        style={[
          s.label,
          { color: style.text },
          small && s.labelSmall,
        ]}
      >
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  labelSmall: {
    fontSize: 9,
    letterSpacing: 0.4,
  },
});
