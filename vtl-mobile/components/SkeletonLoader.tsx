import { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

// ── Core shimmer ──────────────────────────────────────────────────────────────

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({ width, height, borderRadius = RADIUS.md, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const innerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[
        s.outer,
        { width: width as any, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[s.inner, { borderRadius, opacity: innerOpacity }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
  },
  inner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.border,
  },
});

// ── Preset skeletons ──────────────────────────────────────────────────────────

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return <SkeletonLoader width="100%" height={100} borderRadius={RADIUS.xl} style={style} />;
}

export function SkeletonKpi({ style }: { style?: ViewStyle }) {
  return <SkeletonLoader width="48%" height={88} borderRadius={RADIUS.xl} style={style} />;
}

export function SkeletonRow({ style }: { style?: ViewStyle }) {
  return <SkeletonLoader width="100%" height={20} borderRadius={RADIUS.sm} style={style} />;
}

export function SkeletonCircle({ style }: { style?: ViewStyle }) {
  return <SkeletonLoader width={48} height={48} borderRadius={24} style={style} />;
}
