import React, { useState, useEffect } from 'react';
import PayScreen from './PayScreen';
// import ReceiveScreen from './ReceiveScreen';
import BluetoothPayScreen from './BluetoothPayScreen';
import BluetoothReceiveScreen from './BluetoothReceiveScreen';
import BankScreen from './BankScreen';
import api from '../api';
import styles from '../styles/WalletStyles';
import SettingsScreen from './SettingsScreen';
import QRReceiveScreen from './QRReceiveScreen';
import QRScanScreen from './QRScanScreen';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWallet, logoutUser, syncTransactions } from '../api';
import {
  saveBalance,
  getBalance,
  saveCertificate,
  savePublicKey,
  getTransactions,
  clearWalletData,
  clearTransactions,
} from '../storage';

export default function WalletScreen({ username, onLogout }) {
  const [balance, setBalance] = useState(0);
  const [showBTPay, setShowBTPay] = useState(false);
  const [showBTReceive, setShowBTReceive] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [loadingMoney, setLoadingMoney] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // const [showReceive, setShowReceive] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [showQRReceive, setShowQRReceive] = useState(false);
  const [showQRPay, setShowQRPay] = useState(false);
  useEffect(() => {
    loadWalletData();

    // Check online status every 5 seconds
    const interval = setInterval(() => {
      checkOnlineStatus();
    }, 5000);

    // Also check when app comes back to foreground
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        if (nextAppState === 'active') {
          checkOnlineStatus();
        }
      }
    );

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  const checkOnlineStatus = async () => {
    try {
      await getWallet();
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  };

  const loadWalletData = async () => {
    // Load local balance first (instant)
    const localBalance = await getBalance();
    setBalance(localBalance);

    const localTxns = await getTransactions();
    setTransactions(localTxns);

    // Try server
    try {
      const walletData = await getWallet();
      setIsOnline(true);
      await savePublicKey(walletData.public_key);

      // ✅ NEW — restore balance from server if local is 0
      const serverBalance = parseFloat(walletData.issued_balance);
      const localBal = await getBalance();

      if (localBal === 0 && serverBalance > 0) {
        await saveBalance(serverBalance);
        setBalance(serverBalance);
      }

    } catch {
      setIsOnline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMoney = async () => {
    const amount = parseFloat(loadAmount);

    if (!loadAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount');
      return;
    }

    if (amount > 10000) {
      Alert.alert('Too Much', 'Maximum ₹10,000');
      return;
    }

    setLoadingMoney(true);

    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = 'device_' + Date.now().toString();
        await AsyncStorage.setItem('device_id', deviceId);
      }

      // Step 1 — Create Razorpay order
      const orderRes = await api.post('/payment/create-order/', {
        amount: amount,
      });

      const { order_id, key_id, mock } = orderRes.data;
      // const forceMock = true; // remove this for production
      if (mock) {
        // Mock mode — skip Razorpay checkout
        const verifyRes = await api.post('/payment/verify/', {
          razorpay_payment_id: 'mock_pay_' + Date.now(),
          razorpay_order_id: order_id,
          razorpay_signature: 'mock_signature',
          amount: amount * 100,
          device_id: deviceId,
          mock: true,
        });

        await saveBalance(parseFloat(verifyRes.data.new_balance));
        await saveCertificate(verifyRes.data.certificate);
        await savePublicKey(verifyRes.data.public_key);
        setBalance(parseFloat(verifyRes.data.new_balance));
        setShowLoadModal(false);
        setLoadAmount('');
        Alert.alert('✅ Success!', `₹${amount} loaded (mock mode)`);
        return;
      }

      // Step 2 — Open Razorpay checkout
      const RazorpayCheckout = require('react-native-razorpay').default;

      const options = {
        description: 'Load money to OfflinePay wallet',
        currency: 'INR',
        key: key_id,
        amount: amount * 100, // paise
        order_id: order_id,
        name: 'OfflinePay',
        prefill: {
          name: username,
        },
        theme: { color: '#6366f1' },
      };

      const paymentData = await RazorpayCheckout.open(options);

      // Step 3 — Verify payment on server
      const verifyRes = await api.post('/payment/verify/', {
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_signature: paymentData.razorpay_signature,
        amount: amount * 100,
        device_id: deviceId,
        mock: false,
      });

      // Save locally
      await saveBalance(parseFloat(verifyRes.data.new_balance));
      await saveCertificate(verifyRes.data.certificate);
      await savePublicKey(verifyRes.data.public_key);

      setBalance(parseFloat(verifyRes.data.new_balance));
      setShowLoadModal(false);
      setLoadAmount('');

      Alert.alert('✅ Payment Successful!', `₹${amount} loaded to wallet`);

    } catch (error) {
      if (error.code === 'PAYMENT_CANCELLED') {
        Alert.alert('Cancelled', 'Payment was cancelled');
      } else {
        Alert.alert(
          'Failed',
          error.response?.data?.error || error.message || 'Payment failed'
        );
      }
    } finally {
      setLoadingMoney(false);
    }
  };

  const handleSync = async () => {
    const pendingTxns = transactions.filter(t => t.status === 'pending');

    if (pendingTxns.length === 0) {
      Alert.alert('All Good!', 'No pending transactions to sync.');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncTransactions(pendingTxns);
      await clearTransactions();
      await loadWalletData();
      Alert.alert(
        '✅ Synced!',
        `${result.synced} transactions uploaded.\n${result.rejected_duplicates} duplicates ignored.`
      );
    } catch {
      Alert.alert('Failed', 'Could not sync. Check internet connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Sync your transactions before logging out!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout Anyway',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            await clearWalletData();
            onLogout();
          },
        },
      ]
    );
  };

  const handleCashout = () => {
    if (balance <= 0) {
      Alert.alert('No Balance', 'Nothing to cash out.');
      return;
    }

    Alert.alert(
      '🏦 Cash Out',
      `Send ₹${balance.toFixed(2)} to your bank?\n\nThis will:\n1. Sync all transactions\n2. Reset your wallet to ₹0`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cash Out',
          onPress: async () => {
            try {
              // Step 1 — Sync transactions first
              const pendingTxns = transactions.filter(
                t => t.status === 'pending'
              );

              if (pendingTxns.length > 0) {
                const syncResult = await syncTransactions(pendingTxns);
                console.log('Sync result:', syncResult);
                await clearTransactions();
              }

              // Step 2 — Cashout to bank
              const res = await api.post('/wallet/cashout-to-bank/', {
                local_balance: balance,
              });

              // Step 3 — Reset local wallet
              await saveBalance(0);
              await clearWalletData();
              setBalance(0);
              setTransactions([]);

              Alert.alert(
                '✅ Cashed Out!',
                `₹${balance.toFixed(2)} sent to bank.\n` +
                `Bank balance: ₹${res.data.bank_balance}\n` +
                `Wallet reset to ₹0.`
              );

            } catch (error) {
              Alert.alert(
                'Failed',
                error.response?.data?.error || error.message || JSON.stringify(error.response?.data) || 'Cashout failed. Check internet.'
              );
            }
          },
        },
      ]
    );
  };

  const pendingCount = transactions.filter(
    t => t.status === 'pending'
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading your wallet...</Text>
      </View>
    );
  }

  if (showPay) {
    return (
      <PayScreen
        onBack={() => setShowPay(false)}
        onPaymentSent={(newBalance) => {
          setBalance(newBalance);
          setShowPay(false);
        }}
      />
    );
  }

  if (showQRReceive) {
    return (
      <QRReceiveScreen
        onBack={() => setShowQRReceive(false)}
        onPaymentReceived={(newBalance) => {
          setBalance(newBalance);
          setShowQRReceive(false);
        }}
      />
    );
  }

  if (showQRPay) {
    return (
      <QRScanScreen
        onBack={() => setShowQRPay(false)}
        onPaymentSent={(newBalance) => {
          setBalance(newBalance);
          setShowQRPay(false);
        }}
      />
    );
  }


  if (showBank) {
    return (
      <BankScreen
        onBack={() => {
          setShowBank(false);
          loadWalletData();
        }}
      />
    );
  }

  if (showBTPay) {
    return (
      <BluetoothPayScreen
        onBack={() => setShowBTPay(false)}
        onPaymentSent={(newBalance) => {
          setBalance(newBalance);
          setShowBTPay(false);
          // Refresh transaction history
          loadWalletData();
        }}
      />
    );
  }
  if (showBTReceive) {
    return (
      <BluetoothReceiveScreen
        onBack={() => setShowBTReceive(false)}
        onPaymentReceived={(newBalance) => {
          setBalance(newBalance);
          setShowBTReceive(false);
          // Refresh transaction history
          loadWalletData();
        }}
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsScreen
        username={username}
        onLogout={onLogout}
        onBack={() => setShowSettings(false)}
      />
    );
  }

  return (

    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadWalletData();
            }}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello 👋</Text>
            <Text style={styles.username}>{username}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>⚙️ Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Online status */}
        <View style={[
          styles.statusPill,
          { backgroundColor: isOnline ? '#14532d' : '#450a0a' }
        ]}>
          <Text style={styles.statusText}>
            {isOnline
              ? '🟢  Connected — all features available'
              : '🔴  Offline — payments still work via Bluetooth'}
          </Text>
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{balance.toFixed(2)}
          </Text>
          <Text style={styles.balanceNote}>
            💾 Stored on this phone
          </Text>
        </View>

        {/* Bank Account button */}
        <TouchableOpacity
          style={styles.bankBtn}
          onPress={() => setShowBank(true)}
          disabled={!isOnline}
        >
          <Text style={styles.bankBtnText}>
            🏦  View Bank Account
          </Text>
        </TouchableOpacity>

        {/* Pending sync warning */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.syncWarning}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.syncWarningText}>
                ⚠️ {pendingCount} transaction{pendingCount > 1 ? 's' : ''} pending sync — tap to sync
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionCard]}
            onPress={() => setShowQRPay(true)}
            disabled={!isOnline}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionTitle}>Scan QR</Text>
            <Text style={styles.actionSub}>Pay online</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { borderColor: '#6366f1' }]}
            onPress={() => setShowQRReceive(true)}
          >
            <Text style={styles.actionIcon}>📲</Text>
            <Text style={styles.actionTitle}>My QR</Text>
            <Text style={styles.actionSub}>Receive money</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          {/* Load Money */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              !isOnline && styles.actionCardDisabled
            ]}
            onPress={() => {
              if (!isOnline) {
                Alert.alert(
                  'No Internet',
                  'Loading money requires internet connection.'
                );
                return;
              }
              setShowLoadModal(true);
            }}
          >
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionTitle}>Load Money</Text>
            <Text style={styles.actionSub}>Needs internet</Text>
          </TouchableOpacity>

          {/* Pay */}
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardGreen]}
            onPress={() => setShowBTPay(true)}
          >
            <Text style={styles.actionIcon}>📲</Text>
            <Text style={styles.actionTitle}>Pay</Text>
            <Text style={styles.actionSub}>Works offline</Text>
          </TouchableOpacity>
        </View>

        {/* Bluetooth Receive button */}
        <TouchableOpacity
          style={styles.btReceiveCard}
          onPress={() => setShowBTReceive(true)}
        >
          <Text style={styles.btReceiveText}>
            🔵  Receive via Bluetooth
          </Text>
        </TouchableOpacity>

        {/* Sync button */}
        {isOnline && (
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#6366f1" size="small" />
            ) : (
              <Text style={styles.syncBtnText}>
                🔄  Sync Transactions to Server
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Cashout button */}
        {isOnline && balance > 0 && (
          <TouchableOpacity
            style={styles.cashoutBtn}
            onPress={handleCashout}
          >
            <Text style={styles.cashoutBtnText}>
              🏦  Cash Out to Bank
            </Text>
          </TouchableOpacity>
        )}

        {/* Transaction history */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>
            Transaction History
          </Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySub}>
                Load money and make your first payment!
              </Text>
            </View>
          ) : (
            transactions.map((txn, index) => (
              <View key={index} style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  <Text style={styles.txnIcon}>
                    {txn.type === 'sent' ? '📤' : '📥'}
                  </Text>
                  <View>
                    <Text style={styles.txnName}>
                      {txn.type === 'sent'
                        ? `To: ${txn.receiver}`
                        : `From: ${txn.sender}`}
                    </Text>
                    <Text style={styles.txnDate}>
                      {new Date(txn.paid_at).toLocaleDateString()}{' '}
                      {new Date(txn.paid_at).toLocaleTimeString()}
                    </Text>
                    <Text style={[
                      styles.txnStatus,
                      txn.status === 'pending' && { color: '#f59e0b' }
                    ]}>
                      {txn.status === 'pending'
                        ? '⏳ Pending sync'
                        : '✅ Synced'}
                    </Text>
                  </View>
                </View>
                <Text style={[
                  styles.txnAmount,
                  {
                    color: txn.type === 'sent'
                      ? '#ef4444'
                      : '#22c55e'
                  }
                ]}>
                  {txn.type === 'sent' ? '-' : '+'}
                  ₹{txn.amount}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Load Money Modal */}
      <Modal
        visible={showLoadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💰 Load Money</Text>
            <Text style={styles.modalSub}>
              Max ₹10,000 per load
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter amount (e.g. 500)"
              placeholderTextColor="#555"
              value={loadAmount}
              onChangeText={setLoadAmount}
              keyboardType="numeric"
              autoFocus
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleLoadMoney}
              disabled={loadingMoney}
            >
              {loadingMoney ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalButtonText}>
                  Load ₹{loadAmount || '0'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setShowLoadModal(false);
                setLoadAmount('');
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
