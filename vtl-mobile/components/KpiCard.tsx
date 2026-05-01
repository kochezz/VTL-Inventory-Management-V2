import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import { SkeletonKpi } from './SkeletonLoader';

interface TrendProps {
  direction: 'up' | 'down';
  label: string;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  colorGlow: string;
  trend?: TrendProps;
  icon?: string;
  onPress?: () => void;
  loading?: boolean;
}

export function KpiCard({
  title, value, subtitle, color, colorGlow,
  trend, icon, onPress, loading,
}: KpiCardProps) {
  if (loading) {
    return <SkeletonKpi style={s.skeletonSpacer} />;
  }

  const trendColor = trend?.direction === 'up' ? COLORS.green : COLORS.red;
  const trendArrow = trend?.direction === 'up' ? '↑' : '↓';

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: color }, SHADOW.card]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* Glow orb */}
      <View style={[s.glow, { backgroundColor: colorGlow }]} pointerEvents="none" />

      {/* Header row */}
      <View style={s.header}>
        {icon ? <Text style={[s.icon, { color }]}>{icon}</Text> : null}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>

      {/* Value */}
      <Text style={[s.value, { color }]} numberOfLines={1}>{value}</Text>

      {/* Subtitle / trend row */}
      {(subtitle || trend) ? (
        <View style={s.footer}>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : <View />}
          {trend ? (
            <Text style={[s.trend, { color: trendColor }]}>
              {trendArrow} {trend.label}
            </Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  skeletonSpacer: {
    margin: 5,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 16,
    margin: 5,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    borderTopColor: COLORS.border,
    borderRightColor: COLORS.border,
    borderBottomColor: COLORS.border,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
  },
  trend: {
    fontSize: 11,
    fontWeight: '700',
  },
});
