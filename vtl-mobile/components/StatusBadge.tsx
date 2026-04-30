import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const STATUS_MAP: Record<string, { bg: string; text: string }> = {
  RELEASED:   { bg: COLORS.green + '33',  text: COLORS.green },
  COMPLETED:  { bg: COLORS.green + '33',  text: COLORS.green },
  CLOSED:     { bg: COLORS.green + '33',  text: COLORS.green },
  VERIFIED:   { bg: COLORS.green + '33',  text: COLORS.green },

  REVIEW:     { bg: COLORS.blue + '33',   text: COLORS.sky },
  PLANNED:    { bg: COLORS.blue + '33',   text: COLORS.sky },
  IN_PROGRESS:{ bg: COLORS.blue + '33',   text: COLORS.sky },
  in_progress:{ bg: COLORS.blue + '33',   text: COLORS.sky },
  ready_for_setup: { bg: COLORS.blue + '33', text: COLORS.sky },

  DRAFT:      { bg: COLORS.amber + '33',  text: COLORS.amber },
  OPEN:       { bg: COLORS.amber + '33',  text: COLORS.amber },
  CAPA_REQUIRED: { bg: COLORS.amber + '33', text: COLORS.amber },

  OVERDUE:    { bg: COLORS.red + '33',    text: COLORS.red },
  CRITICAL:   { bg: COLORS.red + '33',    text: COLORS.red },
  ZERO_STOCK: { bg: COLORS.red + '33',    text: COLORS.red },
  rejected:   { bg: COLORS.red + '33',    text: COLORS.red },
};

const DEFAULT_STYLE = { bg: COLORS.border + '88', text: COLORS.muted };

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_MAP[status] ?? DEFAULT_STYLE;
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }]}>
      <Text style={[styles.label, { color: style.text }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
