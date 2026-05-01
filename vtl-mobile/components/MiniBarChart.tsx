import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface MiniBarChartProps {
  data: BarItem[];
  maxValue?: number;
  height?: number;
}

export function MiniBarChart({ data, maxValue, height = 80 }: MiniBarChartProps) {
  const computed = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scrollContent}
    >
      {data.map((item, i) => {
        const ratio = Math.max(item.value / computed, 0.03);
        const barH = Math.round(ratio * height);
        const color = item.color ?? COLORS.sky;

        return (
          <View key={i} style={s.column}>
            {/* Value label */}
            <Text style={[s.valueLabel, { color }]}>{item.value}</Text>

            {/* Bar track */}
            <View style={[s.track, { height }]}>
              <View
                style={[
                  s.bar,
                  {
                    height: barH,
                    backgroundColor: color,
                    borderRadius: RADIUS.sm,
                  },
                ]}
              />
            </View>

            {/* X-axis label */}
            <Text style={s.axisLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    gap: 8,
  },
  column: {
    alignItems: 'center',
    minWidth: 36,
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  track: {
    width: 24,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
  },
  axisLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
    maxWidth: 40,
    textAlign: 'center',
  },
});
