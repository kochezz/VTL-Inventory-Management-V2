import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

interface BarItem {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: BarItem[];
  color?: string;
  height?: number;
  showLabels?: boolean;
  currencyPrefix?: string;
}

export function MiniBarChart({
  data,
  color = COLORS.sky,
  height: chartHeight = 64,
  showLabels = true,
  currencyPrefix,
}: MiniBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scrollContent}
    >
      {data.map((item, i) => {
        const barH = Math.max(Math.round((item.value / maxValue) * chartHeight), 2);
        const displayValue = currencyPrefix
          ? `${currencyPrefix}${item.value}`
          : String(item.value);

        return (
          <View key={i} style={s.column}>
            {/* Value label above */}
            {showLabels ? (
              <Text style={s.valueLabel}>{displayValue}</Text>
            ) : null}

            {/* Bar track */}
            <View style={[s.track, { height: chartHeight }]}>
              <View
                style={[
                  s.bar,
                  {
                    height: barH,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>

            {/* Axis label below (truncated to 6 chars) */}
            <Text style={s.axisLabel}>{item.label.substring(0, 6)}</Text>
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
    gap: 4,
  },
  column: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  valueLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  track: {
    width: 24,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: 24,
    opacity: 0.85,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axisLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});
