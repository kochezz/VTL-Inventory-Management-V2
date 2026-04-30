import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import type { Alert } from '../services/api';

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:   COLORS.red,
  MEDIUM: COLORS.amber,
  LOW:    COLORS.blue,
};

const TYPE_ICON: Record<string, string> = {
  NCR:          '⚠',
  CAPA_OVERDUE: '!',
  ZERO_STOCK:   '▣',
  DOC_REVIEW:   '✎',
};

interface AlertBannerProps {
  alerts: Alert[];
  onPress?: (alert: Alert) => void;
}

export function AlertBanner({ alerts, onPress }: AlertBannerProps) {
  if (!alerts.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {alerts.map((alert) => {
        const color = SEVERITY_COLORS[alert.severity] ?? COLORS.muted;
        const icon  = TYPE_ICON[alert.type] ?? '•';
        return (
          <TouchableOpacity
            key={alert.id}
            style={[styles.chip, { backgroundColor: color + '22', borderColor: color }]}
            onPress={() => onPress?.(alert)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipIcon, { color }]}>{icon}</Text>
            <Text style={[styles.chipText, { color }]} numberOfLines={1}>
              {alert.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginVertical: 8,
  },
  content: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 220,
  },
  chipIcon: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
