import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import { StatusBadge } from './StatusBadge';

interface ProfileHeaderProps {
  name: string;
  role: string;
  onLogout: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function ProfileHeader({ name, role, onLogout }: ProfileHeaderProps) {
  const initials = getInitials(name);

  const confirmLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onLogout },
      ],
    );
  };

  return (
    <View style={[s.container, SHADOW.card]}>
      {/* Avatar */}
      <View style={s.avatar}>
        <Text style={s.initials}>{initials}</Text>
      </View>

      {/* Name + role */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <StatusBadge status={role.toUpperCase()} small />
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} activeOpacity={0.75}>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.skyDim,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.glow(COLORS.sky),
  },
  initials: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderBright,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: '700',
  },
});
