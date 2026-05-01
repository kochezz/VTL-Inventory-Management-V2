import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useRouter } from 'expo-router';

// EXPO_PUBLIC_API_URL already includes /api — do NOT append /api in fetch calls below
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugOutput, setDebugOutput] = useState('');

  // RAW TEST — bypasses axios and authStore completely
  const handleRawTest = async () => {
    setDebugOutput('');
    const lines: string[] = [];

    const addLine = (line: string) => {
      lines.push(line);
      setDebugOutput(lines.join('\n'));
    };

    addLine('Testing...');
    addLine('API_URL = ' + API_URL);

    // /auth/login is relative to BASE_URL which already has /api
    const loginUrl = API_URL + '/auth/login';
    addLine('POST to: ' + loginUrl);

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      addLine('HTTP Status: ' + response.status);
      addLine('Content-Type: ' + (response.headers.get('content-type') ?? 'none'));

      const rawText = await response.text();
      addLine('--- Raw Response ---');
      addLine(rawText.substring(0, 600));

      // If 200, try to parse as JSON to confirm it works
      if (response.status === 200) {
        try {
          const json = JSON.parse(rawText);
          addLine('--- Parsed OK ---');
          addLine('Has token: ' + !!json.token);
          addLine('Has user: ' + !!json.user);
          addLine('User email: ' + (json.user?.email ?? 'n/a'));
        } catch {
          addLine('WARNING: Status 200 but response is not valid JSON');
        }
      }

    } catch (err: any) {
      addLine('FETCH ERROR: ' + err.message);
      addLine('Check network connectivity and URL');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    setDebugOutput('');
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>VTL Executive</Text>
      <Text style={styles.subtitle}>Vilagio Trading Limited</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748B"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748B"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.loginButtonText}>Sign In</Text>
        }
      </TouchableOpacity>

      {/* DEBUG BUTTON — remove once login is confirmed working */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={handleRawTest}
      >
        <Text style={styles.debugButtonText}>🔍 Test API Connection</Text>
      </TouchableOpacity>

      {debugOutput ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugLabel}>DEBUG OUTPUT:</Text>
          <ScrollView style={styles.debugScroll} nestedScrollEnabled>
            <Text style={styles.debugText}>{debugOutput}</Text>
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#0EA5E9',
    fontSize: 16,
    marginBottom: 48,
  },
  input: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F1F5F9',
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugButton: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  debugButtonText: {
    color: '#64748B',
    fontSize: 13,
  },
  debugBox: {
    width: '100%',
    backgroundColor: '#0F2942',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    padding: 12,
    maxHeight: 320,
  },
  debugLabel: {
    color: '#0EA5E9',
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 12,
    letterSpacing: 1,
  },
  debugScroll: {
    maxHeight: 270,
  },
  debugText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});