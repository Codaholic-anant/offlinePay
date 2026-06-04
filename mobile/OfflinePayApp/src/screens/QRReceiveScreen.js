import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { getBalance } from '../storage';
import api from '../api';

export default function QRReceiveScreen({ onBack, onPaymentReceived }) {
  const [username, setUsername] = useState('');
  const [balance, setBalance] = useState(0);
  const [checking, setChecking] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    loadData();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const loadData = async () => {
    const bal = await getBalance();
    setBalance(bal);
    const uname = await AsyncStorage.getItem('username');
    setUsername(uname || '');
  };

  // QR code contains username so payer can scan and auto-fill
  const qrData = JSON.stringify({
    type: 'offlinepay',
    username: username,
    app: 'OfflinePay',
  });

  const startWaiting = () => {
    setIsWaiting(true);
    setChecking(true);

    // Register as receiver on server
    api.post('/wallet/register-receiver/', {
      ip_address: 'relay',
    }).catch(() => {});

    // Poll every 2 seconds for incoming payment
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/wallet/check-relay/');
        if (res.data.payment) {
          clearInterval(interval);
          setIsWaiting(false);
          setChecking(false);

          const payment = res.data.payment;
          const newBalance = balance + parseFloat(payment.amount);

          setLastPayment({
            amount: payment.amount,
            sender: res.data.sender,
            newBalance,
          });

          setBalance(newBalance);

          // Confirm receipt
          await api.post('/wallet/confirm-relay/', {
            txn_id: payment.txn_id,
          });

          Alert.alert(
            '🎉 Payment Received!',
            `₹${payment.amount} from ${res.data.sender}\nNew balance: ₹${newBalance.toFixed(2)}`
          );

          onPaymentReceived(newBalance);
        }
      } catch {
        // Keep polling
      }
    }, 2000);

    setPollInterval(interval);

    // Stop after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setIsWaiting(false);
      setChecking(false);
    }, 300000);
  };

  const stopWaiting = () => {
    if (pollInterval) clearInterval(pollInterval);
    setIsWaiting(false);
    setChecking(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay me on OfflinePay! My username: ${username}`,
        title: 'OfflinePay',
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* QR Code Card */}
      <View style={styles.qrCard}>
        <Text style={styles.qrLabel}>Scan to Pay Me</Text>
        {username ? (
          <View style={styles.qrBox}>
            <QRCode
              value={qrData}
              size={200}
              backgroundColor="white"
              color="#0f0f23"
            />
          </View>
        ) : (
          <ActivityIndicator color="#6366f1" size="large" />
        )}
        <Text style={styles.usernameText}>{username}</Text>
        <Text style={styles.qrSub}>OfflinePay User</Text>
      </View>

      {/* Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
      </View>

      {/* Wait for payment button */}
      <TouchableOpacity
        style={[styles.waitBtn, isWaiting && styles.waitBtnActive]}
        onPress={isWaiting ? stopWaiting : startWaiting}
      >
        {checking && isWaiting ? (
          <View style={styles.waitingRow}>
            <ActivityIndicator color="white" size="small" />
            <Text style={styles.waitBtnText}>  Waiting for payment...</Text>
          </View>
        ) : (
          <Text style={styles.waitBtnText}>
            {isWaiting ? '⏹ Stop Waiting' : '📡 Wait for Online Payment'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>📤 Share Username</Text>
      </TouchableOpacity>

      {/* Last payment */}
      {lastPayment && (
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>✅ Last Payment</Text>
          <Text style={styles.paymentAmount}>+₹{lastPayment.amount}</Text>
          <Text style={styles.paymentFrom}>From: {lastPayment.sender}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          📱 Show QR code to payer → they scan it → payment sent instantly
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  qrCard: {
    backgroundColor: '#1a1a3e',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 16,
  },
  qrLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 20,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  qrBox: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 20,
  },
  usernameText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  qrSub: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  balanceLabel: {
    color: '#888',
    fontSize: 14,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  waitBtn: {
    backgroundColor: '#6366f1',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  waitBtnActive: {
    backgroundColor: '#4f46e5',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  shareBtn: {
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
    marginBottom: 16,
  },
  shareBtnText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: '#14532d',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#166534',
  },
  paymentTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  paymentAmount: {
    color: '#4ade80',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentFrom: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  infoBox: {
    marginHorizontal: 24,
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  infoText: {
    color: '#888',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
  },
});