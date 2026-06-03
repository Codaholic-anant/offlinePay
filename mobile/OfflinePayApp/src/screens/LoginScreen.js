import styles from '../styles/LoginStyles';

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
  	console.log('LOGIN ERROR:', JSON.stringify(error.response?.data));
  	console.log('LOGIN ERROR MSG:', error.message);
  	console.log('LOGIN STATUS:', error.response?.status);
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

