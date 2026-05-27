import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { loginUser, registerUser } from '../api';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter username and password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        // Register new account
        await registerUser(username.trim(), password.trim());
        Alert.alert(
          '✅ Account Created!',
          'Now login with your credentials.',
          [{ text: 'OK', onPress: () => setIsRegistering(false) }]
        );
      } else {
        // Login existing account
        await loginUser(username.trim(), password.trim());
        onLoginSuccess(username.trim());
      }
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        'Something went wrong. Check your connection.';
      Alert.alert('Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Text style={styles.logo}>💸</Text>
        <Text style={styles.appName}>OfflinePay</Text>
        <Text style={styles.tagline}>
          Pay anyone. No internet needed.
        </Text>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="#555"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Submit button */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegistering ? '🚀 Create Account' : '🔑 Login'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch mode */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsRegistering(!isRegistering);
              setUsername('');
              setPassword('');
            }}
          >
            <Text style={styles.switchText}>
              {isRegistering
                ? 'Already have an account? Login →'
                : "Don't have an account? Register →"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            1. Load money once (needs internet){'\n'}
            2. Pay anyone via Bluetooth{'\n'}
            3. No internet needed for payments{'\n'}
            4. Cash out anytime (needs internet)
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 72,
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    marginBottom: 40,
  },
  form: {
    width: '100%',
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 20,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 10,
    padding: 14,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#6366f1',
    fontSize: 14,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  infoTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 10,
    fontSize: 15,
  },
  infoText: {
    color: '#888',
    lineHeight: 24,
    fontSize: 13,
  },
});