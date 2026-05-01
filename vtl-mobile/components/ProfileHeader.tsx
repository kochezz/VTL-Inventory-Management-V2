import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import { StatusBadge } from './StatusBadge';

interface ProfileUser {
  full_name: string;
  role: string;
  email: string;
}

interface ProfileHeaderProps {
  user: ProfileUser;
  onLogout: () => void;
}

function getInitials(name: string): string {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function ProfileHeader({ user, onLogout }: ProfileHeaderProps) {
  const initials = getInitials(user.full_name);

  const confirmLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <View style={[s.container, SHADOW.card]}>
      {/* Initials avatar */}
      <View style={s.avatar}>
        <Text style={s.initials}>{initials}</Text>
      </View>

      {/* Name + role badge */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{user.full_name}</Text>
        <StatusBadge status={user.role} small />
      </View>

      {/* Logout button */}
      <TouchableOpacity onPress={confirmLogout} activeOpacity={0.7} hitSlop={8}>
        <Text style={s.logoutIcon}>⏻</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: COLORS.sky,
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  logoutIcon: {
    color: COLORS.red,
    fontSize: 20,
  },
});
