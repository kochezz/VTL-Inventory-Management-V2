import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Polygon } from 'react-native-svg';
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
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * innerW,
    y: padY + (1 - (v - min) / range) * innerH,
  }));

  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');

  // Polygon closes the fill area below the sparkline
  const fillPoints = [
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${height}`,
    `${pts[0].x},${height}`,
  ].join(' ');

  return (
    <View style={[s.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Polygon points={fillPoints} fill={color} fillOpacity={0.12} stroke="none" />
        <Polyline
          points={linePoints}
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
  container: { overflow: 'hidden' },
});
