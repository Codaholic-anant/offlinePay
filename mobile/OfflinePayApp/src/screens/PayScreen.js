import React, { useState } from 'react';
import styles from '../styles/PayStyles';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildPaymentPackage, deductBalance } from '../utils/payment';

// Update this if ngrok restarts
const BASE_URL = 'https://outreach-doorstep-splatter.ngrok-free.dev/api';

export default function PayScreen({ onBack, onPaymentSent }) {
  const [receiverUsername, setReceiverUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);

  const steps = [
    'Building payment',
    'Sending to relay',
    'Waiting for receiver',
    'Confirmed!',
  ];

  const handleSendPayment = async () => {
    if (!receiverUsername.trim()) {
      Alert.alert('Missing', 'Enter receiver username');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Missing', 'Enter a valid amount');
      return;
    }

    setSending(true);
    setStep(0);

    try {
      // Step 1 — Build payment package with certificate
      const payment = await buildPaymentPackage(
        parseFloat(amount),
        receiverUsername.trim()
      );
      setStep(1);

      // Step 2 — Send to Django relay
      const token = await AsyncStorage.getItem('access_token');

      const relayResponse = await fetch(
        `${BASE_URL}/wallet/send-relay/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            receiver: receiverUsername.trim(),
            payment: payment,
          }),
        }
      );

      const relayResult = await relayResponse.json();

      if (!relayResult.success) {
        throw new Error(relayResult.error || 'Relay failed');
      }

      setStep(2);

      // Step 3 — Poll for confirmation from receiver
      // Try every 2 seconds, max 30 seconds (15 attempts)
      let confirmed = false;

      for (let i = 0; i < 15; i++) {
        // Wait 2 seconds between each check
        await new Promise(resolve => setTimeout(resolve, 2000));

        const confirmResponse = await fetch(
          `${BASE_URL}/wallet/check-confirm/?txn_id=${payment.txn_id}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
          }
        );

        const confirmData = await confirmResponse.json();

        if (confirmData.confirmed) {
          confirmed = true;
          setStep(3);
          break;
        }
      }

      if (confirmed) {
        // Deduct from our local balance
        const newBalance = await deductBalance(
          parseFloat(amount),
          payment.txn_id,
          receiverUsername.trim()
        );

        Alert.alert(
          '✅ Payment Successful!',
          `₹${amount} sent to ${receiverUsername}\nYour new balance: ₹${newBalance.toFixed(2)}`,
          [{
            text: 'Done',
            onPress: () => onPaymentSent(newBalance)
          }]
        );
      } else {
        Alert.alert(
          '⏰ Timed Out',
          'Receiver did not pick up payment in 30 seconds.\n\nMake sure receiver has tapped "Start Listening".'
        );
      }

    } catch (error) {
      Alert.alert(
        '❌ Payment Failed',
        error.message || 'Something went wrong'
      );
    } finally {
      setSending(false);
      setStep(0);
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
        {/* Back button */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>📲 Send Payment</Text>
        <Text style={styles.subtitle}>
          Receiver must tap "Start Listening" first
        </Text>

        {/* Progress indicator when sending */}
        {sending && (
          <View style={styles.progressCard}>
            {steps.map((s, i) => (
              <View key={i} style={styles.progressRow}>
                <View style={[
                  styles.progressDot,
                  i < step && styles.progressDotDone,
                  i === step && styles.progressDotActive,
                ]}>
                  {i < step ? (
                    <Text style={styles.progressCheck}>✓</Text>
                  ) : i === step ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.progressNum}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.progressLabel,
                  i === step && styles.progressLabelActive,
                  i < step && styles.progressLabelDone,
                ]}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment form */}
        <View style={styles.form}>
          <Text style={styles.label}>Receiver Username</Text>
          <Text style={styles.hint}>
            The username of the person you are paying
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. merchant1"
            placeholderTextColor="#555"
            value={receiverUsername}
            onChangeText={setReceiverUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!sending}
          />

          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#555"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            editable={!sending}
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={handleSendPayment}
          disabled={sending}
        >
          {sending ? (
            <View style={styles.sendingRow}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.sendBtnText}>
                {steps[step]}...
              </Text>
            </View>
          ) : (
            <Text style={styles.sendBtnText}>
              Send ₹{amount || '0'} →
            </Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🔒 Secure offline payment</Text>
          <Text style={styles.infoText}>
            Your payment package includes a signed certificate.
            {'\n'}Receiver verifies it is genuine automatically.
            {'\n'}Unique transaction ID prevents double spending.
            {'\n\n'}Both phones need internet for the relay.
            {'\n'}Future version will use true Bluetooth.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
