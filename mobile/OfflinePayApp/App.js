import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import WalletScreen from './src/screens/WalletScreen';
import PinScreen from './src/screens/PinScreen';

const PIN_KEY = 'wallet_pin';

export default function App() {
  const [appState, setAppState] = useState('loading');
  // loading → checking session
  // login   → show login screen
  // pin_setup → first time, create PIN
  // pin_verify → returning user, verify PIN
  // wallet  → show wallet

  const [username, setUsername] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const savedUsername = await AsyncStorage.getItem('username');
      const savedPin = await AsyncStorage.getItem(PIN_KEY);

      if (token && savedUsername) {
        setUsername(savedUsername);
        if (savedPin) {
          // Has PIN — verify it
          setAppState('pin_verify');
        } else {
          // No PIN yet — set one up
          setAppState('pin_setup');
        }
      } else {
        // Not logged in
        setAppState('login');
      }
    } catch (error) {
      setAppState('login');
    }
  };

  const handleLoginSuccess = async (name) => {
    setUsername(name);
    const savedPin = await AsyncStorage.getItem(PIN_KEY);
    if (savedPin) {
      setAppState('pin_verify');
    } else {
      setAppState('pin_setup');
    }
  };

  const handleLogout = async () => {
    setUsername(null);
    setAppState('login');
  };

  // Loading spinner
  if (appState === 'loading') {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#0f0f23',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Login screen
  if (appState === 'login') {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // PIN setup — first time
  if (appState === 'pin_setup') {
    return (
      <PinScreen
        mode="setup"
        onSuccess={() => setAppState('wallet')}
      />
    );
  }

  // PIN verify — every open
  if (appState === 'pin_verify') {
    return (
      <PinScreen
        mode="verify"
        onSuccess={() => setAppState('wallet')}
      />
    );
  }

  // Main wallet
  return (
    <WalletScreen
      username={username}
      onLogout={handleLogout}
    />
  );
}