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
  title,
  value,
  subtitle,
  color,
  colorGlow,
  trend,
  icon,
  onPress,
  loading,
}: KpiCardProps) {
  if (loading) return <SkeletonKpi />;

  const trendColor = trend?.direction === 'up' ? COLORS.green : COLORS.red;
  const trendArrow = trend?.direction === 'up' ? '↑' : '↓';

  const Inner = (
    <View style={[s.card, { borderLeftColor: color, borderTopWidth: 2, borderTopColor: color }, SHADOW.card]}>
      {/* Top-left secondary glow */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: 40, height: 40,
        borderRadius: RADIUS.xxl,
        backgroundColor: colorGlow,
        opacity: 0.2,
      }} pointerEvents="none" />
      {/* Glow orb */}
      <View style={[s.glow, { backgroundColor: colorGlow }]} pointerEvents="none" />

      {/* Icon */}
      {icon ? <Text style={[s.icon, { color }]}>{icon}</Text> : null}

      {/* Title */}
      <Text style={s.title} numberOfLines={1}>{title}</Text>

      {/* Value */}
      <Text style={s.value} numberOfLines={1}>{value}</Text>

      {/* Trend */}
      {trend ? (
        <Text style={[s.trend, { color: trendColor }]}>
          {trendArrow} {trend.label}
        </Text>
      ) : null}

      {/* Subtitle */}
      {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={s.touchWrapper}>
        {Inner}
      </TouchableOpacity>
    );
  }

  return <View style={s.touchWrapper}>{Inner}</View>;
}

const s = StyleSheet.create({
  touchWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: RADIUS.xxl,
    opacity: 0.5,
  },
  icon: {
    fontSize: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 34,
    marginBottom: 4,
  },
  trend: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
