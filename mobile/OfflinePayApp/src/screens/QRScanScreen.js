import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBalance, saveBalance } from '../storage';
import api from '../api';

export default function QRScanScreen({ onBack, onPaymentSent }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedUser, setScannedUser] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [balance, setBalance] = useState(0);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    const bal = await getBalance();
    setBalance(bal);
  };

  const handleBarCodeScanned = ({ data }) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'offlinepay' && parsed.username) {
        setScanned(true);
        setScannedUser(parsed.username);
        setShowScanner(false);
        setShowPayModal(true);
      } else {
        Alert.alert('Invalid QR', 'This QR is not an OfflinePay code.');
      }
    } catch {
      Alert.alert('Invalid QR', 'Could not read this QR code.');
    }
  };

  const handleManualPay = () => {
    if (!manualUsername.trim()) {
      Alert.alert('Error', 'Enter a username');
      return;
    }
    setScannedUser(manualUsername.trim());
    setShowPayModal(true);
  };

  const handleConfirmPayment = async () => {
    const amt = parseFloat(amount);

    if (!amount || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }

    if (amt > balance) {
      Alert.alert('Insufficient Balance', `Your balance is ₹${balance.toFixed(2)}`);
      return;
    }

    setPaying(true);
    setShowPayModal(false);

    try {
      const myUsername = await AsyncStorage.getItem('username');
      const txnId = 'txn_' + Date.now();

      // Create payment object
      const payment = {
        txn_id: txnId,
        sender: myUsername,
        receiver: scannedUser,
        amount: amt,
        paid_at: new Date().toISOString(),
      };

      // Send via relay server
      await api.post('/wallet/send-relay/', {
        receiver: scannedUser,
        payment: payment,
      });

      // Deduct from local balance
      const newBalance = balance - amt;
      await saveBalance(newBalance);
      setBalance(newBalance);

      // Wait for confirmation
      let confirmed = false;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const res = await api.get(`/wallet/check-confirm/?txn_id=${txnId}`);
          if (res.data.confirmed) {
            confirmed = true;
            break;
          }
        } catch {}
      }

      setPaying(false);
      setScanned(false);
      setAmount('');
      setScannedUser('');
      setManualUsername('');

      Alert.alert(
        confirmed ? '✅ Payment Confirmed!' : '📤 Payment Sent!',
        `₹${amt} sent to ${scannedUser}\nNew balance: ₹${newBalance.toFixed(2)}`,
        [{ text: 'Done', onPress: () => onPaymentSent(newBalance) }]
      );

    } catch (error) {
      setPaying(false);
      Alert.alert('Failed', error.response?.data?.error || error.message || 'Payment failed');
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
      </View>

      {/* QR Scanner */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SCAN QR CODE</Text>

        {showScanner ? (
          <View style={styles.cameraBox}>
            <CameraView
              style={styles.camera}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
            </View>
            <TouchableOpacity
              style={styles.closeScanBtn}
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.closeScanText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.openScanBtn}
            onPress={async () => {
              if (!permission.granted) {
                await requestPermission();
              }
              setScanned(false);
              setShowScanner(true);
            }}
          >
            <Text style={styles.qrIcon}>📷</Text>
            <Text style={styles.openScanText}>Tap to Scan QR Code</Text>
            <Text style={styles.openScanSub}>Point camera at receiver's QR</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Manual entry */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OR ENTER USERNAME</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Enter username"
            placeholderTextColor="#555"
            value={manualUsername}
            onChangeText={setManualUsername}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.manualPayBtn}
            onPress={handleManualPay}
          >
            <Text style={styles.manualPayText}>Pay</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Paying overlay */}
      {paying && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.overlayText}>Sending payment...</Text>
          <Text style={styles.overlaySub}>Please wait</Text>
        </View>
      )}

      {/* Payment Modal */}
      <Modal
        visible={showPayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💸 Send Payment</Text>
            <Text style={styles.modalTo}>To: {scannedUser}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter amount"
              placeholderTextColor="#555"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              autoFocus
            />

            <Text style={styles.modalBalance}>
              Balance: ₹{balance.toFixed(2)}
            </Text>

            <TouchableOpacity
              style={styles.modalPayBtn}
              onPress={handleConfirmPayment}
            >
              <Text style={styles.modalPayText}>
                Send ₹{amount || '0'} →
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setShowPayModal(false);
                setScannedUser('');
                setScanned(false);
                setAmount('');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  openScanBtn: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  qrIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  openScanText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  openScanSub: {
    color: '#888',
    fontSize: 13,
  },
  cameraBox: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 300,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: '#6366f1',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  closeScanBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeScanText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  manualRow: {
    flexDirection: 'row',
    gap: 12,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#1a1a3e',
    borderRadius: 14,
    padding: 16,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  manualPayBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualPayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  overlayText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  overlaySub: {
    color: '#888',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1a1a3e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  modalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalTo: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#0f0f23',
    borderRadius: 14,
    padding: 20,
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBalance: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalPayBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 15,
  },
});