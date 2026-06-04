import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, ActivityIndicator,
  Alert, TextInput, Modal, Dimensions, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { getWallet, logoutUser, syncTransactions } from '../api';
import api from '../api';
import {
  saveBalance, getBalance, saveCertificate,
  savePublicKey, getTransactions, clearWalletData,
  clearTransactions,
} from '../storage';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation, username, onLogout }) {
  const { theme } = useTheme();
  const [balance, setBalance] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [loadingMoney, setLoadingMoney] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const s = makeStyles(theme);

  useEffect(() => {
    loadWalletData();
    const interval = setInterval(checkOnlineStatus, 10000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkOnlineStatus();
    });
    return () => { clearInterval(interval); sub.remove(); };
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
    const localBalance = await getBalance();
    setBalance(localBalance);
    const localTxns = await getTransactions();
    setTransactions(localTxns);
    try {
      const walletData = await getWallet();
      setIsOnline(true);
      if (walletData.public_key) await savePublicKey(walletData.public_key);
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
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }
    if (amount > 10000) {
      Alert.alert('Limit', 'Maximum ₹10,000 per load');
      return;
    }
    setLoadingMoney(true);
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = 'device_' + Date.now().toString();
        await AsyncStorage.setItem('device_id', deviceId);
      }
      const res = await api.post('/wallet/load-from-bank/', {
        amount, device_id: deviceId,
      });
      const result = res.data;
      await saveBalance(parseFloat(result.new_balance));
      await saveCertificate(result.certificate);
      await savePublicKey(result.public_key);
      setBalance(parseFloat(result.new_balance));
      setShowLoadModal(false);
      setLoadAmount('');
      Alert.alert('✅ Money Loaded!', `₹${amount} added to wallet`);
    } catch (error) {
      Alert.alert('Failed', error.response?.data?.error || 'Could not load money');
    } finally {
      setLoadingMoney(false);
    }
  };

  const handleCashout = () => {
    if (balance <= 0) { Alert.alert('No Balance', 'Nothing to cash out'); return; }
    Alert.alert(
      'Cash Out',
      `Send ₹${balance.toFixed(2)} to your bank?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cash Out', onPress: async () => {
            try {
              const pendingTxns = transactions.filter(t => t.status === 'pending');
              if (pendingTxns.length > 0) {
                await syncTransactions(pendingTxns);
                await clearTransactions();
              }
              const res = await api.post('/wallet/cashout-to-bank/', {
                local_balance: balance,
              });
              await saveBalance(0);
              await clearWalletData();
              setBalance(0);
              setTransactions([]);
              Alert.alert('✅ Done!', `₹${balance.toFixed(2)} sent to bank\nBank balance: ₹${res.data.bank_balance}`);
            } catch (error) {
              Alert.alert('Failed', error.response?.data?.error || 'Cashout failed');
            }
          }
        }
      ]
    );
  };

  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadWalletData(); }}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'} 👋</Text>
            <Text style={s.username}>{username}</Text>
          </View>
          <View style={[s.onlineDot, { backgroundColor: isOnline ? theme.success : theme.danger }]} />
        </View>

        {/* Balance Card — GPay style */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Total Balance</Text>
          <Text style={s.balanceAmount}>₹{balance.toFixed(2)}</Text>
          <View style={s.balanceRow}>
            <Text style={s.balanceNote}>💾 Stored offline on device</Text>
            <View style={[s.badge, { backgroundColor: isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }]}>
              <Text style={[s.badgeText, { color: isOnline ? '#22c55e' : '#ef4444' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions — GPay style grid */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionsGrid}>

            {/* Load Money */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => {
                if (!isOnline) { Alert.alert('No Internet', 'Loading needs internet'); return; }
                setShowLoadModal(true);
              }}
            >
              <View style={[s.actionIcon, { backgroundColor: '#1e3a5f' }]}>
                <Text style={s.actionEmoji}>💰</Text>
              </View>
              <Text style={s.actionLabel}>Add Money</Text>
            </TouchableOpacity>

            {/* Bluetooth Pay */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => navigation.navigate('BluetoothPay')}
            >
              <View style={[s.actionIcon, { backgroundColor: '#1a3a2a' }]}>
                <Text style={s.actionEmoji}>🔵</Text>
              </View>
              <Text style={s.actionLabel}>BT Pay</Text>
            </TouchableOpacity>

            {/* Scan QR */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => navigation.navigate('QRScan')}
            >
              <View style={[s.actionIcon, { backgroundColor: '#2a1a3e' }]}>
                <Text style={s.actionEmoji}>📷</Text>
              </View>
              <Text style={s.actionLabel}>Scan QR</Text>
            </TouchableOpacity>

            {/* My QR */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => navigation.navigate('QRReceive')}
            >
              <View style={[s.actionIcon, { backgroundColor: '#3a1a1a' }]}>
                <Text style={s.actionEmoji}>📲</Text>
              </View>
              <Text style={s.actionLabel}>My QR</Text>
            </TouchableOpacity>

            {/* Bank */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => navigation.navigate('Bank')}
              disabled={!isOnline}
            >
              <View style={[s.actionIcon, { backgroundColor: '#1a2a3a', opacity: isOnline ? 1 : 0.5 }]}>
                <Text style={s.actionEmoji}>🏦</Text>
              </View>
              <Text style={[s.actionLabel, { opacity: isOnline ? 1 : 0.5 }]}>Bank</Text>
            </TouchableOpacity>

            {/* Cash Out */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={handleCashout}
              disabled={!isOnline || balance <= 0}
            >
              <View style={[s.actionIcon, { backgroundColor: '#3a1a1a', opacity: (isOnline && balance > 0) ? 1 : 0.5 }]}>
                <Text style={s.actionEmoji}>🏧</Text>
              </View>
              <Text style={[s.actionLabel, { opacity: (isOnline && balance > 0) ? 1 : 0.5 }]}>Cash Out</Text>
            </TouchableOpacity>

            {/* Receive BT */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => navigation.navigate('BluetoothReceive')}
            >
              <View style={[s.actionIcon, { backgroundColor: '#1a3a1a' }]}>
                <Text style={s.actionEmoji}>📥</Text>
              </View>
              <Text style={s.actionLabel}>Receive</Text>
            </TouchableOpacity>

            {/* Relay Pay */}
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => navigation.navigate('Pay')}
              disabled={!isOnline}
            >
              <View style={[s.actionIcon, { backgroundColor: '#2a2a1a', opacity: isOnline ? 1 : 0.5 }]}>
                <Text style={s.actionEmoji}>📡</Text>
              </View>
              <Text style={[s.actionLabel, { opacity: isOnline ? 1 : 0.5 }]}>Relay Pay</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Pending sync banner */}
        {pendingCount > 0 && (
          <TouchableOpacity
            style={s.syncBanner}
            onPress={async () => {
              setSyncing(true);
              try {
                const pending = transactions.filter(t => t.status === 'pending');
                await syncTransactions(pending);
                await clearTransactions();
                await loadWalletData();
                Alert.alert('✅ Synced!', `${pending.length} transactions uploaded`);
              } catch {
                Alert.alert('Failed', 'Sync failed. Check internet.');
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={s.syncBannerText}>
                ⚠️ {pendingCount} pending — tap to sync
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Recent transactions */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[s.seeAll, { color: theme.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptySub}>Make your first payment!</Text>
            </View>
          ) : (
            transactions.slice(0, 3).map((txn, i) => (
              <View key={i} style={s.txnCard}>
                <View style={[s.txnAvatar, {
                  backgroundColor: txn.type === 'sent' ? '#3a1a1a' : '#1a3a1a'
                }]}>
                  <Text style={s.txnAvatarEmoji}>
                    {txn.type === 'sent' ? '📤' : '📥'}
                  </Text>
                </View>
                <View style={s.txnInfo}>
                  <Text style={s.txnName}>
                    {txn.type === 'sent' ? txn.receiver : txn.sender}
                  </Text>
                  <Text style={s.txnDate}>
                    {new Date(txn.paid_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short',
                    })} · {txn.status === 'pending' ? '⏳ Pending' : '✅ Synced'}
                  </Text>
                </View>
                <Text style={[s.txnAmount, {
                  color: txn.type === 'sent' ? theme.danger : theme.success
                }]}>
                  {txn.type === 'sent' ? '-' : '+'}₹{txn.amount}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Load Money Modal */}
      <Modal visible={showLoadModal} transparent animationType="slide" onRequestClose={() => setShowLoadModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add Money</Text>
            <Text style={s.modalSub}>From your bank account · Max ₹10,000</Text>
            <TextInput
              style={s.modalInput}
              placeholder="₹0"
              placeholderTextColor={theme.textMuted}
              value={loadAmount}
              onChangeText={setLoadAmount}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity style={s.modalBtn} onPress={handleLoadMoney} disabled={loadingMoney}>
              {loadingMoney
                ? <ActivityIndicator color="white" />
                : <Text style={s.modalBtnText}>Add ₹{loadAmount || '0'}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => { setShowLoadModal(false); setLoadAmount(''); }}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 24,
      paddingTop: 56, paddingBottom: 16,
    },
    greeting: { color: theme.textSecondary, fontSize: 13 },
    username: { color: theme.textPrimary, fontSize: 22, fontWeight: 'bold' },
    onlineDot: { width: 10, height: 10, borderRadius: 5 },
    balanceCard: {
      backgroundColor: theme.primary,
      marginHorizontal: 24, borderRadius: 24,
      padding: 28, marginBottom: 24,
    },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
    balanceAmount: { color: 'white', fontSize: 48, fontWeight: 'bold', marginBottom: 12 },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balanceNote: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    section: { paddingHorizontal: 24, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: 'bold' },
    seeAll: { fontSize: 14, fontWeight: '600' },
    actionsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    },
    actionItem: {
      width: (width - 48 - 36) / 4,
      alignItems: 'center', gap: 8,
    },
    actionIcon: {
      width: 56, height: 56, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
    },
    actionEmoji: { fontSize: 24 },
    actionLabel: { color: theme.textSecondary, fontSize: 11, textAlign: 'center' },
    syncBanner: {
      backgroundColor: theme.warningBg,
      marginHorizontal: 24, borderRadius: 12,
      padding: 14, alignItems: 'center', marginBottom: 16,
      borderWidth: 1, borderColor: theme.warning,
    },
    syncBannerText: { color: theme.warning, fontWeight: '600', fontSize: 13 },
    emptyCard: {
      backgroundColor: theme.bgCard, borderRadius: 20,
      padding: 40, alignItems: 'center',
      borderWidth: 1, borderColor: theme.border,
    },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
    emptySub: { color: theme.textMuted, fontSize: 13 },
    txnCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 8, borderWidth: 1, borderColor: theme.border,
    },
    txnAvatar: {
      width: 44, height: 44, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    txnAvatarEmoji: { fontSize: 20 },
    txnInfo: { flex: 1 },
    txnName: { color: theme.textPrimary, fontWeight: '600', marginBottom: 2 },
    txnDate: { color: theme.textMuted, fontSize: 12 },
    txnAmount: { fontWeight: 'bold', fontSize: 16 },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.bgCard,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 32, borderWidth: 1, borderColor: theme.border,
    },
    modalTitle: { color: theme.textPrimary, fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
    modalSub: { color: theme.textMuted, fontSize: 13, marginBottom: 24 },
    modalInput: {
      backgroundColor: theme.bgInput, borderRadius: 14,
      padding: 20, color: theme.textPrimary,
      fontSize: 36, fontWeight: 'bold',
      borderWidth: 1, borderColor: theme.border,
      textAlign: 'center', marginBottom: 16,
    },
    modalBtn: {
      backgroundColor: theme.primary, borderRadius: 14,
      padding: 18, alignItems: 'center', marginBottom: 12,
    },
    modalBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    modalCancel: { padding: 16, alignItems: 'center' },
    modalCancelText: { color: theme.textMuted, fontSize: 15 },
  });
}