import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface MiniLineIndicatorProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function MiniLineIndicator({
  data,
  color = COLORS.sky,
  width = 120,
  height = 40,
}: MiniLineIndicatorProps) {
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * innerW;
    const y = padY + (1 - (v - min) / range) * innerH;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Closed path: line + drop to bottom-right + across bottom + up to start
  const last = points[points.length - 1];
  const first = points[0];
  const fillPath =
    `M ${first.x},${first.y} ` +
    points
      .slice(1)
      .map((p) => `L ${p.x},${p.y}`)
      .join(' ') +
    ` L ${last.x},${height} L ${first.x},${height} Z`;

  const gradId = 'mlg';

  return (
    <View style={[s.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Fill area */}
        <Path d={fillPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
