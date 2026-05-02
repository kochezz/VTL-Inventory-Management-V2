import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants/theme';

interface MonthData {
  label: string;
  revenue: number;
}

interface WeeklyItem {
  week_label: string;
  month_short: string;
  revenue: number | string;
}

interface Props {
  currentMonth: MonthData;
  previousMonth: MonthData;
  weeklyData?: WeeklyItem[];
  currentColor?: string;
  previousColor?: string;
  currency?: 'USD' | 'ZMW';
  exchangeRate?: number;
}

export function MonthComparisonChart({
  currentMonth,
  previousMonth,
  weeklyData = [],
  currentColor = COLORS.sky,
  previousColor = COLORS.teal,
  currency = 'USD',
  exchangeRate = 27,
}: Props) {
  const fmtVal = (usdVal: number): string => {
    const v = currency === 'ZMW' ? usdVal * exchangeRate : usdVal;
    const prefix = currency === 'ZMW' ? 'K' : '$';
    if (v >= 1_000_000) return prefix + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1000) return prefix + (v / 1000).toFixed(1) + 'k';
    return prefix + v.toFixed(0);
  };
  const maxRevenue = Math.max(currentMonth.revenue, previousMonth.revenue, 1);

  const prevBarH = previousMonth.revenue > 0
    ? Math.max(Math.round((previousMonth.revenue / maxRevenue) * 100), 4)
    : 0;
  const currBarH = currentMonth.revenue > 0
    ? Math.max(Math.round((currentMonth.revenue / maxRevenue) * 100), 4)
    : 0;

  const prevShort = previousMonth.label.slice(0, 3);
  const currShort = currentMonth.label.slice(0, 3);
  const prevWeeks = weeklyData.filter(w => w.month_short === prevShort);
  const currWeeks = weeklyData.filter(w => w.month_short === currShort);
  const weekCount = Math.max(prevWeeks.length, currWeeks.length);
  const maxWeekRev = Math.max(
    ...prevWeeks.map(w => Number(w.revenue) || 0),
    ...currWeeks.map(w => Number(w.revenue) || 0),
    1,
  );

  return (
    <View>
      {/* ── Section A: side-by-side monthly bars ────────────────────────────── */}
      <View style={s.monthRow}>
        {/* Previous month */}
        <View style={s.monthColumn}>
          <Text style={[s.barValueLabel, { color: previousColor }]}>
            {previousMonth.revenue === 0 ? '—' : fmtVal(previousMonth.revenue)}
          </Text>
          <View style={s.barArea}>
            {previousMonth.revenue === 0 ? (
              <View style={[s.noDataBox, { borderColor: previousColor }]}>
                <Text style={[s.noDataText, { color: previousColor }]}>No data</Text>
              </View>
            ) : (
              <View style={[s.bar, { height: prevBarH, backgroundColor: previousColor }]} />
            )}
          </View>
          <Text style={s.monthLabel}>{previousMonth.label.slice(0, 3)}</Text>
        </View>

        {/* Current month */}
        <View style={s.monthColumn}>
          <Text style={[s.barValueLabel, { color: currentColor }]}>
            {fmtVal(currentMonth.revenue)}
          </Text>
          <View style={s.barArea}>
            <View style={[s.bar, { height: currBarH, backgroundColor: currentColor }]} />
          </View>
          <Text style={s.monthLabel}>{currentMonth.label.slice(0, 3)}</Text>
        </View>
      </View>

      {/* ── Section B: week-by-week grouped bars ────────────────────────────── */}
      {weekCount > 0 && (
        <>
          <Text style={s.weeklySectionLabel}>Weekly Progression</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.weeklyScroll}
          >
            {Array.from({ length: weekCount }).map((_, i) => {
              const prevRev = Number(prevWeeks[i]?.revenue) || 0;
              const currRev = Number(currWeeks[i]?.revenue) || 0;
              const prevH = prevRev > 0 ? Math.max(Math.round((prevRev / maxWeekRev) * 60), 2) : 0;
              const currH = currRev > 0 ? Math.max(Math.round((currRev / maxWeekRev) * 60), 2) : 0;
              return (
                <View key={i} style={s.weekGroup}>
                  <View style={s.weekBarsRow}>
                    <View style={[s.weekBar, { height: prevH, backgroundColor: previousColor, opacity: 0.7 }]} />
                    <View style={[s.weekBar, { height: currH, backgroundColor: currentColor, opacity: 0.9 }]} />
                  </View>
                  <Text style={s.weekLabel}>W{i + 1}</Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: previousColor }]} />
          <Text style={s.legendPrevText}>{previousMonth.label}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: currentColor }]} />
          <Text style={s.legendCurrText}>{currentMonth.label}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Section A
  monthRow:      { flexDirection: 'row', gap: 16, paddingHorizontal: 16 },
  monthColumn:   { flex: 1, alignItems: 'center' },
  barValueLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  barArea:       { height: 100, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar:           { width: '80%', borderTopLeftRadius: 6, borderTopRightRadius: 6, opacity: 0.85 },
  noDataBox:     { height: 28, width: '80%', borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  noDataText:    { fontSize: 10, fontWeight: '600' },
  monthLabel:    { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },

  // Section B
  weeklySectionLabel: { fontSize: 11, color: COLORS.textMuted, marginLeft: 16, marginTop: 14, marginBottom: 6 },
  weeklyScroll:       { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'flex-end' },
  weekGroup:          { alignItems: 'center', marginRight: 8 },
  weekBarsRow:        { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  weekBar:            { width: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  weekLabel:          { fontSize: 9, color: COLORS.textMuted, marginTop: 4 },

  // Legend
  legend:        { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendPrevText:{ fontSize: 11, color: COLORS.textMuted },
  legendCurrText:{ fontSize: 11, color: COLORS.textPrimary },
});
