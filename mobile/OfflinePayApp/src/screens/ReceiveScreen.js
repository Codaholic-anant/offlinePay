import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { processIncomingPayment } from '../utils/payment';
import { getBalance } from '../storage';

// Update this if ngrok restarts
const BASE_URL = 'https://outreach-doorstep-splatter.ngrok-free.dev/api';

export default function ReceiveScreen({ onBack, onPaymentReceived }) {
  const [myIP, setMyIP] = useState('');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('idle');
  const [lastPayment, setLastPayment] = useState(null);
  const [balance, setBalance] = useState(0);
  const serverRef = useRef(null);

  useEffect(() => {
    getMyIP();
    loadBalance();
    // Cleanup when screen closes
    return () => stopServer();
  }, []);

  const getMyIP = async () => {
    try {
      const ip = await Network.getIpAddressAsync();
      setMyIP(ip);
    } catch {
      setMyIP('Could not get IP');
    }
  };

  const loadBalance = async () => {
    const bal = await getBalance();
    setBalance(bal);
  };

  const startListening = async () => {
    setListening(true);
    setStatus('listening');
    startPollingServer();
  };

  const startPollingServer = async () => {
    const token = await AsyncStorage.getItem('access_token');

    // Poll Django relay every 2 seconds
    // When payment arrives — process it immediately
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${BASE_URL}/wallet/check-relay/`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
          }
        );

        const data = await response.json();

        // Payment found in relay!
        if (data.payment) {
          clearInterval(interval);
          serverRef.current = null;
          setStatus('receiving');

          // Process payment locally
          // Verifies certificate, updates balance
          const result = await processIncomingPayment(data.payment);

          // Send confirmation back so sender knows we got it
          await fetch(`${BASE_URL}/wallet/confirm-relay/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({
              txn_id: data.payment.txn_id
            }),
          });

          // Update screen
          setLastPayment(result);
          setBalance(result.newBalance);
          setStatus('done');
          setListening(false);

          Alert.alert(
            '🎉 Payment Received!',
            `₹${result.amount} from ${result.sender}\nNew balance: ₹${result.newBalance.toFixed(2)}`
          );

          onPaymentReceived(result.newBalance);
        }

      } catch (error) {
        console.log('Polling error:', error.message);
      }
    }, 2000);

    // Save interval reference so we can stop it
    serverRef.current = interval;
  };

  const stopServer = () => {
    // Clear the polling interval
    if (serverRef.current) {
      clearInterval(serverRef.current);
      serverRef.current = null;
    }
    setListening(false);
    setStatus('idle');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>📥 Receive Payment</Text>
        <Text style={styles.subtitle}>
          Tap Start Listening then tell payer your username
        </Text>

        {/* My IP — shown for info */}
        <View style={styles.ipCard}>
          <Text style={styles.ipLabel}>Your Device IP</Text>
          <Text style={styles.ipAddress}>{myIP || 'Getting...'}</Text>
          <Text style={styles.ipHint}>
            Payer needs your USERNAME — not IP
          </Text>
        </View>

        {/* Balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{balance.toFixed(2)}
          </Text>
        </View>

        {/* Status indicator */}
        <View style={[
          styles.statusCard,
          listening && styles.statusCardActive
        ]}>
          <Text style={styles.statusIcon}>
            {status === 'done' ? '✅' : listening ? '🟢' : '⚫'}
          </Text>
          <Text style={styles.statusText}>
            {status === 'idle' && 'Not listening — tap Start'}
            {status === 'listening' && 'Waiting for payment...'}
            {status === 'receiving' && 'Processing payment...'}
            {status === 'done' && 'Payment received!'}
          </Text>
          {listening && status === 'listening' && (
            <ActivityIndicator
              color="#22c55e"
              size="small"
            />
          )}
        </View>

        {/* Start/Stop button */}
        <TouchableOpacity
          style={[
            styles.listenBtn,
            listening && styles.listenBtnStop
          ]}
          onPress={listening ? stopServer : startListening}
        >
          <Text style={styles.listenBtnText}>
            {listening ? '⏹  Stop Listening' : '▶  Start Listening'}
          </Text>
        </TouchableOpacity>

        {/* Show last payment received */}
        {lastPayment && (
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>
              ✅ Payment Received!
            </Text>
            <Text style={styles.paymentAmount}>
              +₹{lastPayment.amount}
            </Text>
            <Text style={styles.paymentFrom}>
              From: {lastPayment.sender}
            </Text>
            <Text style={styles.paymentNew}>
              New Balance: ₹{lastPayment.newBalance?.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📡 How to receive payment</Text>
          <Text style={styles.infoText}>
            1. Tap "Start Listening" below{'\n'}
            2. Tell payer your USERNAME{'\n'}
            3. Payer opens Pay screen{'\n'}
            4. Payer enters your username + amount{'\n'}
            5. Payment arrives automatically!{'\n'}
            {'\n'}
            Both phones need internet for relay.{'\n'}
            Payment logic runs offline on device.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 20,
  },
  backText: {
    color: '#6366f1',
    fontSize: 16,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 20,
  },
  ipCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
    marginBottom: 16,
  },
  ipLabel: {
    color: '#818cf8',
    fontSize: 13,
    marginBottom: 8,
  },
  ipAddress: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  ipHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 4,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 16,
    gap: 12,
  },
  statusCardActive: {
    borderColor: '#22c55e',
    backgroundColor: '#052e16',
  },
  statusIcon: {
    fontSize: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  listenBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  listenBtnStop: {
    backgroundColor: '#7f1d1d',
  },
  listenBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentCard: {
    backgroundColor: '#052e16',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 16,
    alignItems: 'center',
  },
  paymentTitle: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  paymentAmount: {
    color: '#22c55e',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentFrom: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  paymentNew: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
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
    lineHeight: 26,
    fontSize: 13,
  },
});