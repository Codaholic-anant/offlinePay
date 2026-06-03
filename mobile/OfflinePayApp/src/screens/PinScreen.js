import React, { useState, useEffect } from 'react';
import styles from '../styles/PinStyles';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'wallet_pin';

export default function PinScreen({ onSuccess, mode = 'verify' }) {
  // mode = 'setup' (first time) or 'verify' (every open)
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(mode === 'setup' ? 'create' : 'verify');
  const [shake, setShake] = useState(false);

  // When 4 digits entered — process automatically
  useEffect(() => {
    if (pin.length === 4) {
      setTimeout(() => handlePinComplete(), 100);
    }
  }, [pin]);

  const handlePinComplete = async () => {
    if (step === 'verify') {
      // Check PIN against stored PIN
      const storedPin = await AsyncStorage.getItem(PIN_KEY);
      if (pin === storedPin) {
        onSuccess();
      } else {
        // Wrong PIN — shake and clear
        Vibration.vibrate(500);
        setPin('');
        Alert.alert('Wrong PIN', 'Try again');
      }
    }

    else if (step === 'create') {
      // First time setup — save PIN and ask to confirm
      setConfirmPin(pin);
      setPin('');
      setStep('confirm');
    }

    else if (step === 'confirm') {
      // Confirm PIN matches
      if (pin === confirmPin) {
        await AsyncStorage.setItem(PIN_KEY, pin);
        Alert.alert('✅ PIN Set!', 'Your wallet is now protected.');
        onSuccess();
      } else {
        Vibration.vibrate(500);
        setPin('');
        setConfirmPin('');
        setStep('create');
        Alert.alert('No Match', 'PINs did not match. Try again.');
      }
    }
  };

  const handlePress = (digit) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const getTitle = () => {
    if (step === 'verify') return 'Enter PIN';
    if (step === 'create') return 'Create PIN';
    if (step === 'confirm') return 'Confirm PIN';
  };

  const getSubtitle = () => {
    if (step === 'verify') return 'Enter your 4-digit PIN';
    if (step === 'create') return 'Choose a 4-digit PIN';
    if (step === 'confirm') return 'Enter PIN again to confirm';
  };

  // Number pad buttons
  const buttons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ];

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Text style={styles.logo}>💸</Text>
      <Text style={styles.appName}>OfflinePay</Text>

      {/* Title */}
      <Text style={styles.title}>{getTitle()}</Text>
      <Text style={styles.subtitle}>{getSubtitle()}</Text>

      {/* PIN dots */}
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
            ]}
          />
        ))}
      </View>

      {/* Number pad */}
      <View style={styles.pad}>
        {buttons.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.padRow}>
            {row.map((btn, btnIndex) => (
              <TouchableOpacity
                key={btnIndex}
                style={[
                  styles.padBtn,
                  btn === '' && styles.padBtnEmpty,
                ]}
                onPress={() => {
                  if (btn === '⌫') handleDelete();
                  else if (btn !== '') handlePress(btn);
                }}
                disabled={btn === ''}
              >
                <Text style={styles.padBtnText}>{btn}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

