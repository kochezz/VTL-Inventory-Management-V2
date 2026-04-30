import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const { login, isLoading }    = useAuthStore();

  const handleSignIn = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      setError(
        (err as Error).message ?? 'Sign in failed. Please try again.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
<ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>VTL</Text>
          <Text style={styles.logoSub}>Executive</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Sign In</Text>
          <Text style={styles.subheading}>Vilagio Trading Limited</Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@vilagio.co.zw"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>VTL ERP · Executive Dashboard</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.sky,
    letterSpacing: 6,
  },
  logoSub: {
    fontSize: 16,
    color: COLORS.muted,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 8,
    color: '#FCA5A5',
    padding: 10,
    marginBottom: 16,
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: COLORS.sky,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 32,
    textAlign: 'center',
  },
});
