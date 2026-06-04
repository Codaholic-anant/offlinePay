import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getTransactions } from '../storage';

export default function HistoryScreen() {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const s = makeStyles(theme);

  useEffect(() => { loadTxns(); }, []);

  const loadTxns = async () => {
    const txns = await getTransactions();
    setTransactions(txns.reverse());
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    if (status === 'pending') return theme.warning;
    if (status === 'synced') return theme.success;
    return theme.textMuted;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Transaction History</Text>
        <Text style={s.count}>{transactions.length} total</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadTxns(); }}
            tintColor={theme.primary}
          />
        }
      >
        {transactions.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptySub}>Make a payment to see history</Text>
          </View>
        ) : (
          <View style={s.list}>
            {transactions.map((txn, i) => (
              <View key={i} style={s.txnCard}>
                <View style={[s.avatar, {
                  backgroundColor: txn.type === 'sent' ? '#3a1a1a' : '#1a3a1a'
                }]}>
                  <Text style={s.avatarEmoji}>
                    {txn.type === 'sent' ? '📤' : '📥'}
                  </Text>
                </View>
                <View style={s.info}>
                  <Text style={s.name}>
                    {txn.type === 'sent'
                      ? `Paid to ${txn.receiver}`
                      : `From ${txn.sender}`}
                  </Text>
                  <Text style={s.date}>
                    {new Date(txn.paid_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <View style={[s.statusBadge, { backgroundColor: getStatusColor(txn.status) + '20' }]}>
                    <Text style={[s.statusText, { color: getStatusColor(txn.status) }]}>
                      {txn.status === 'pending' ? '⏳ Pending sync' : '✅ Synced'}
                    </Text>
                  </View>
                </View>
                <Text style={[s.amount, {
                  color: txn.type === 'sent' ? theme.danger : theme.success
                }]}>
                  {txn.type === 'sent' ? '-' : '+'}₹{txn.amount}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: {
      paddingHorizontal: 24, paddingTop: 56,
      paddingBottom: 16, flexDirection: 'row',
      justifyContent: 'space-between', alignItems: 'center',
    },
    title: { color: theme.textPrimary, fontSize: 24, fontWeight: 'bold' },
    count: { color: theme.textMuted, fontSize: 14 },
    list: { padding: 24, gap: 8 },
    empty: {
      alignItems: 'center', padding: 60,
    },
    emptyEmoji: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 8 },
    emptySub: { color: theme.textMuted, fontSize: 14 },
    txnCard: {
      backgroundColor: theme.bgCard,
      borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: theme.border,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    avatarEmoji: { fontSize: 22 },
    info: { flex: 1 },
    name: { color: theme.textPrimary, fontWeight: '600', marginBottom: 2 },
    date: { color: theme.textMuted, fontSize: 11, marginBottom: 6 },
    statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    statusText: { fontSize: 11, fontWeight: '600' },
    amount: { fontWeight: 'bold', fontSize: 16 },
  });
}