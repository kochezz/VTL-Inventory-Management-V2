import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon?: string;
  onPress?: () => void;
}

export function KpiCard({ title, value, subtitle, color, icon, onPress }: KpiCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        {icon ? <Text style={[styles.icon, { color }]}>{icon}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    margin: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
});
