import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import LoginScreen from './src/screens/LoginScreen';
import PinScreen from './src/screens/PinScreen';
import AppNavigator from './src/navigation/AppNavigator';

const PIN_KEY = 'wallet_pin';

function AppContent() {
  const { theme } = useTheme();
  const [appState, setAppState] = useState('loading');
  const [username, setUsername] = useState(null);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const savedUsername = await AsyncStorage.getItem('username');
      const savedPin = await AsyncStorage.getItem(PIN_KEY);
      if (token && savedUsername) {
        setUsername(savedUsername);
        setAppState(savedPin ? 'pin_verify' : 'pin_setup');
      } else {
        setAppState('login');
      }
    } catch {
      setAppState('login');
    }
  };

  const handleLoginSuccess = async (name) => {
    setUsername(name);
    const savedPin = await AsyncStorage.getItem(PIN_KEY);
    setAppState(savedPin ? 'pin_verify' : 'pin_setup');
  };

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (appState === 'login') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (appState === 'pin_setup') {
    return <PinScreen mode="setup" onSuccess={() => setAppState('wallet')} />;
  }

  if (appState === 'pin_verify') {
    return <PinScreen mode="verify" onSuccess={() => setAppState('wallet')} />;
  }

  if (appState === 'wallet') {
    return (
      <AppNavigator
        username={username}
        onLogout={() => { setUsername(null); setAppState('login'); }}
      />
    );
  }

  return (
    <AppNavigator
      username={username}
      onLogout={() => { setUsername(null); setAppState('login'); }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}