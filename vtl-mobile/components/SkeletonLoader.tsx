import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({ width = '100%', height, borderRadius = RADIUS.md, style }: SkeletonProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: COLORS.border, opacity }, style]} />
  );
}

export const SkeletonCard  = (p?: { style?: ViewStyle }) => <SkeletonLoader width="100%" height={100} borderRadius={RADIUS.lg} style={p?.style} />;
export const SkeletonKpi   = (p?: { style?: ViewStyle }) => <SkeletonLoader width="48%"  height={88}  borderRadius={RADIUS.xl} style={p?.style} />;
export const SkeletonRow   = (p?: { style?: ViewStyle }) => <SkeletonLoader width="100%" height={20}  borderRadius={RADIUS.sm} style={p?.style} />;
export const SkeletonCircle= (p?: { style?: ViewStyle }) => <SkeletonLoader width={48}   height={48}  borderRadius={24}        style={p?.style} />;
