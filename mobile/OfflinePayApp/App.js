import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import WalletScreen from './src/screens/WalletScreen';

export default function App() {
  const [username, setUsername] = useState(null);
  const [checking, setChecking] = useState(true);

  // When app opens — check if already logged in
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const savedUsername = await AsyncStorage.getItem('username');
      if (token && savedUsername) {
        setUsername(savedUsername);
      }
    } catch (error) {
      console.log('Session check error:', error);
    } finally {
      setChecking(false);
    }
  };

  // Show spinner while checking session
  if (checking) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#0f0f23',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Show wallet if logged in, login screen if not
  if (username) {
    return (
      <WalletScreen
        username={username}
        onLogout={() => setUsername(null)}
      />
    );
  }

  return (
    <LoginScreen
      onLoginSuccess={(name) => setUsername(name)}
    />
  );
}