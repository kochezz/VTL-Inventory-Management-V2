import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export type ToastType = 'success' | 'error';

interface Props {
  message: string;
  type: ToastType;
  visible: boolean;
}

export function Toast({ message, type, visible }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, message]);

  if (!visible) return null;

  const bg = type === 'success' ? COLORS.green : COLORS.red;

  return (
    <Animated.View style={[s.toast, { backgroundColor: bg, opacity }]}>
      <Text style={s.toastText}>{type === 'success' ? '✓ ' : '✕ '}{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
