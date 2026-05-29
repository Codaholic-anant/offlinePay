import React, { useState, useEffect } from 'react';
import PayScreen from './PayScreen';
import ReceiveScreen from './ReceiveScreen';
import { cashout } from '../api';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWallet, loadMoney, logoutUser, syncTransactions } from '../api';
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
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [loadingMoney, setLoadingMoney] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    // Load local data first — always works offline
    const localBalance = await getBalance();
    setBalance(localBalance);

    const localTxns = await getTransactions();
    setTransactions(localTxns);

    // Try server
    try {
      const walletData = await getWallet();
      setIsOnline(true);
      await savePublicKey(walletData.public_key);
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
      Alert.alert('Too Much', 'Maximum load is ₹10,000');
      return;
    }

    setLoadingMoney(true);
    try {
      // Get device ID — unique for this phone
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = 'device_' + Date.now().toString();
        await AsyncStorage.setItem('device_id', deviceId);
      }

      const result = await loadMoney(amount, deviceId);

      // Save everything locally
      await saveBalance(parseFloat(result.new_balance));
      await saveCertificate(result.certificate);
      await savePublicKey(result.public_key);

      setBalance(parseFloat(result.new_balance));
      setShowLoadModal(false);
      setLoadAmount('');

      Alert.alert('✅ Success!', `₹${amount} loaded to your wallet`);
    } catch (error) {
      console.log('FULL ERROR:', JSON.stringify(error.response?.data));
      console.log('ERROR MSG:', error.message);
      Alert.alert(
        'Failed',
        error.response?.data?.error ||
        error.message ||
        'Could not load money. Check internet.'
      );
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
    `Send ₹${balance.toFixed(2)} to your bank?\n\nThis will reset your wallet.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Cash Out',
        onPress: async () => {
          try {
            const result = await cashout(balance);
            await saveBalance(0);
            await clearWalletData();
            setBalance(0);
            setTransactions([]);
            Alert.alert(
              '✅ Cashed Out!',
              `₹${balance.toFixed(2)} sent to your bank.\nWallet reset to ₹0.`
            );
          } catch (error) {
            Alert.alert(
              'Failed',
              error.response?.data?.error || 'Cashout failed. Check internet.'
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

    if (showReceive) {
    return (
      <ReceiveScreen
        onBack={() => setShowReceive(false)}
        onPaymentReceived={(newBalance) => {
          setBalance(newBalance);
          setShowReceive(false);
        }}
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
            onPress={handleLogout}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Logout</Text>
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
            onPress={() => setShowPay(true)}
          >
            <Text style={styles.actionIcon}>📲</Text>
            <Text style={styles.actionTitle}>Pay</Text>
            <Text style={styles.actionSub}>Works offline</Text>
          </TouchableOpacity>
        </View>

        {/* Receive button */}
        <TouchableOpacity
          style={styles.receiveCard}
          onPress={() => setShowReceive(true)}
        >
          <Text style={styles.receiveText}>
            📥  Receive Payment via Bluetooth
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  greeting: {
    color: '#888',
    fontSize: 14,
  },
  username: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: '#1a1a3e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 13,
  },
  statusPill: {
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  statusText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#6366f1',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 52,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  balanceNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  syncWarning: {
    backgroundColor: '#92400e',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncWarningText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionCardGreen: {
    backgroundColor: '#14532d',
    borderColor: '#166534',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 4,
  },
  actionSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  receiveCard: {
    backgroundColor: '#1a1a3e',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 12,
  },
  receiveText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  syncBtn: {
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
    marginBottom: 24,
  },
  syncBtnText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    marginHorizontal: 24,
    marginBottom: 40,
  },
  historyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyBox: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
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
  },
  txnRow: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txnIcon: {
    fontSize: 28,
  },
  txnName: {
    color: 'white',
    fontWeight: '600',
    marginBottom: 2,
  },
  txnDate: {
    color: '#666',
    fontSize: 11,
    marginBottom: 2,
  },
  txnStatus: {
    color: '#888',
    fontSize: 11,
  },
  txnAmount: {
    fontWeight: 'bold',
    fontSize: 18,
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
    marginBottom: 6,
  },
  modalSub: {
    color: '#888',
    fontSize: 13,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: '#0f0f23',
    borderRadius: 14,
    padding: 18,
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCancel: {
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 15,
  },
  cashoutBtn: {
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 24,
  },
  cashoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});