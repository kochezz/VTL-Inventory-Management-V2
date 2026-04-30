import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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
    setDebugOutput('Testing...\n');
    setDebugOutput(prev => prev + 'API_URL = ' + API_URL + '\n');

    if (!API_URL) {
      setDebugOutput(prev => prev + 'ERROR: EXPO_PUBLIC_API_URL is undefined!\n');
      setDebugOutput(prev => prev + 'Check your .env file and restart with --clear\n');
      return;
    }

    const loginUrl = API_URL + '/auth/login';
    setDebugOutput(prev => prev + 'POST to: ' + loginUrl + '\n');

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      setDebugOutput(prev => prev + 'HTTP Status: ' + response.status + '\n');
      setDebugOutput(prev => prev + 'Content-Type: ' + response.headers.get('content-type') + '\n');

      const rawText = await response.text();
      setDebugOutput(prev => prev + 'Raw Response (first 500 chars):\n' + rawText.substring(0, 500) + '\n');

    } catch (err: any) {
      setDebugOutput(prev => prev + 'FETCH ERROR: ' + err.message + '\n');
      setDebugOutput(prev => prev + 'This usually means wrong URL or no network\n');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Login failed');
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

      {/* DEBUG BUTTON — REMOVE AFTER FIXING */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={handleRawTest}
      >
        <Text style={styles.debugButtonText}>🔍 Test API Connection</Text>
      </TouchableOpacity>

      {debugOutput ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugLabel}>DEBUG OUTPUT:</Text>
          <ScrollView style={styles.debugScroll}>
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
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  debugButtonText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  debugBox: {
    width: '100%',
    backgroundColor: '#0F2942',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    padding: 12,
    maxHeight: 300,
  },
  debugLabel: {
    color: '#0EA5E9',
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 12,
  },
  debugScroll: {
    maxHeight: 250,
  },
  debugText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
