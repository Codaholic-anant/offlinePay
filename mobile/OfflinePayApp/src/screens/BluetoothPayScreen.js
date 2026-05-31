import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import {
  requestBluetoothPermissions,
  checkBluetoothState,
  scanForPaymentDevices,
  stopScan,
  sendBluetoothPayment,
} from '../utils/bluetooth';

export default function BluetoothPayScreen({ onBack, onPaymentSent }) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [paying, setPaying] = useState(false);
  const [btReady, setBtReady] = useState(false);
  const [btStatus, setBtStatus] = useState('Setting up Bluetooth...');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [amount, setAmount] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    setupBluetooth();
    return () => stopScan();
  }, []);

  const setupBluetooth = async () => {
    setBtStatus('Requesting permissions...');
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      setBtStatus('Permissions denied');
      Alert.alert(
        'Permissions Required',
        'Go to Settings → Apps → OfflinePayApp → Permissions\nGrant Nearby devices + Location'
      );
      return;
    }
    setBtStatus('Checking Bluetooth...');
    setTimeout(async () => {
      try {
        const isOn = await checkBluetoothState();
        if (!isOn) {
          setBtStatus('Bluetooth is off');
          Alert.alert('Turn On Bluetooth', 'Please turn on Bluetooth.');
          return;
        }
        setBtStatus('Bluetooth ready ✅');
        setBtReady(true);
      } catch (err) {
        setBtStatus('Error: ' + err.message);
      }
    }, 1500);
  };

  const startScan = () => {
    setDevices([]);
    setScanning(true);
    setBtStatus('Scanning...');
    console.log('Starting scan...');

    scanForPaymentDevices(
      (device) => {
        console.log('Found device:', device.name, device.address);
        setDevices(prev => {
          const exists = prev.find(d => d.address === device.address);
          if (exists) return prev;
          return [...prev, device];
        });
      },
      (error) => {
        console.log('Scan error:', error.message);
        setScanning(false);
        setBtStatus('Scan error: ' + error.message);
      }
    );

    setTimeout(() => {
      setScanning(false);
      setBtStatus('Scan complete — ' + devices.length + ' found');
    }, 15000);
  };

  const handleDeviceTap = (device) => {
    console.log('Device tapped:', device.name, device.address);
    setSelectedDevice(device);
    setAmount('');
    setShowPayModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }

    if (!selectedDevice) {
      Alert.alert('Error', 'No device selected');
      return;
    }

    setShowPayModal(false);
    setPaying(true);

    try {
      console.log('Sending payment to:', selectedDevice.name);
      const result = await sendBluetoothPayment(
        selectedDevice,
        parseFloat(amount),
        selectedDevice.name || 'merchant'
      );

      Alert.alert(
        '✅ Payment Sent!',
        `₹${amount} sent to ${selectedDevice.name}\nNew balance: ₹${result.newBalance.toFixed(2)}`,
        [{ text: 'Done', onPress: () => onPaymentSent(result.newBalance) }]
      );
    } catch (error) {
      console.log('Payment failed:', error.message);
      Alert.alert('❌ Payment Failed', error.message || 'Could not send payment');
    } finally {
      setPaying(false);
      setSelectedDevice(null);
      setAmount('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Back */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>🔵 Bluetooth Pay</Text>
      <Text style={styles.subtitle}>
        True offline payment — zero internet needed
      </Text>

      {/* Status */}
      <View style={[
        styles.statusCard,
        btReady && styles.statusCardReady
      ]}>
        <Text style={styles.statusText}>
          {btReady ? '🔵 ' : '⚫ '}{btStatus}
        </Text>
      </View>

      {/* Scan button */}
      <TouchableOpacity
        style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
        onPress={startScan}
        disabled={scanning || paying}
      >
        {scanning ? (
          <View style={styles.row}>
            <ActivityIndicator color="white" size="small" />
            <Text style={styles.scanBtnText}>  Scanning...</Text>
          </View>
        ) : (
          <Text style={styles.scanBtnText}>🔍 Scan for Merchants</Text>
        )}
      </TouchableOpacity>

      {/* Retry */}
      {!btReady && (
        <TouchableOpacity style={styles.retryBtn} onPress={setupBluetooth}>
          <Text style={styles.retryText}>🔄 Retry Setup</Text>
        </TouchableOpacity>
      )}

      {/* Device count */}
      {devices.length > 0 && (
        <Text style={styles.deviceCount}>
          {devices.length} device{devices.length > 1 ? 's' : ''} found — tap to pay
        </Text>
      )}

      {/* Empty state */}
      {devices.length === 0 && !scanning && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyText}>No devices found</Text>
          <Text style={styles.emptySub}>
            Make sure merchant's phone{'\n'}
            Bluetooth is ON and discoverable
          </Text>
        </View>
      )}

      {/* Device list */}
      <FlatList
        data={devices}
        keyExtractor={item => item.address || item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.deviceCard}
            onPress={() => handleDeviceTap(item)}
            disabled={paying}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>
                {item.name || 'Unknown Device'}
              </Text>
              <Text style={styles.deviceId}>
                {item.address || item.id}
              </Text>
            </View>
            <View style={styles.payBadge}>
              <Text style={styles.payBadgeText}>Tap to Pay</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Paying overlay */}
      {paying && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.overlayText}>Sending payment...</Text>
          <Text style={styles.overlaySubtext}>
            Keep phones close together
          </Text>
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
            <Text style={styles.modalDevice}>
              To: {selectedDevice?.name || 'Unknown'}
            </Text>

            <Text style={styles.modalLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter amount"
              placeholderTextColor="#555"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              autoFocus
            />

            <TouchableOpacity
              style={styles.modalPayBtn}
              onPress={handleConfirmPayment}
            >
              <Text style={styles.modalPayBtnText}>
                Send ₹{amount || '0'} →
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setShowPayModal(false);
                setSelectedDevice(null);
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
    padding: 24,
    paddingTop: 56,
  },
  backBtn: { marginBottom: 20 },
  backText: { color: '#6366f1', fontSize: 16 },
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
  },
  statusCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  statusCardReady: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  scanBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanBtnDisabled: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryBtn: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  retryText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceCount: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySub: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },
  deviceCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  deviceName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  deviceId: { color: '#888', fontSize: 11 },
  payBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  payBadgeText: {
    color: 'white',
    fontSize: 12,
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
  overlaySubtext: {
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
  modalDevice: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
  },
  modalLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 8,
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
    marginBottom: 16,
  },
  modalPayBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPayBtnText: {
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