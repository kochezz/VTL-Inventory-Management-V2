import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import VTLAppHeader from '../components/VTLAppHeader';
import { useAuthStore } from '../stores/authStore';

export default function AccessRestrictedScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <VTLAppHeader title="VTL Executive" subtitle="Leadership access" />
      <View style={s.content}>
        <View style={s.card}>
          <View style={s.iconCircle}>
            <Text style={s.iconText}>!</Text>
          </View>
          <Text style={s.title}>Access Restricted</Text>
          <Text style={s.subtext}>
            VTL Executive mobile access is reserved for Managers, CFO, CEO and System Admin users.
          </Text>
          <TouchableOpacity style={s.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.borderBright,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...SHADOW.card,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.amberGlow,
    borderColor: COLORS.amber,
    borderWidth: 1,
    marginBottom: 16,
  },
  iconText: {
    color: COLORS.amber,
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  signOutButton: {
    backgroundColor: COLORS.sky,
    borderRadius: RADIUS.md,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  signOutText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
