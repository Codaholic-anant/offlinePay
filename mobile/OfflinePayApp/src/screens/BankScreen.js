import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../api';

export default function BankScreen({ onBack }) {
  const [bankData, setBankData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBankData();
  }, []);

  useFocusEffect(
  useCallback(() => {
    loadWalletData();
  }, [])
);

  const loadBankData = async () => {
    try {
      const res = await api.get('/bank/');
      setBankData(res.data);
    } catch (err) {
      Alert.alert('Error', 'Could not load bank data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Back */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🏦 Bank Account</Text>
        <Text style={styles.subtitle}>
          OfflinePay Demo Bank
        </Text>

        {/* Bank card */}
        <View style={styles.bankCard}>
          <Text style={styles.bankName}>
            {bankData?.bank_name}
          </Text>
          <Text style={styles.accountLabel}>Account Number</Text>
          <Text style={styles.accountNumber}>
            {bankData?.account_number?.replace(/(\d{4})/g, '$1 ').trim()}
          </Text>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balance}>
            ₹{parseFloat(bankData?.balance || 0).toFixed(2)}
          </Text>
          <Text style={styles.demoNote}>
            Demo account — ₹10,000 starting balance
          </Text>
        </View>

        {/* Transaction history */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>

        {bankData?.transactions?.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          bankData?.transactions?.map((txn, index) => (
            <View key={index} style={styles.txnRow}>
              <View>
                <Text style={styles.txnDesc}>{txn.description}</Text>
                <Text style={styles.txnDate}>
                  {new Date(txn.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.txnRight}>
                <Text style={[
                  styles.txnAmount,
                  {
                    color: txn.type === 'debit'
                      ? '#ef4444'
                      : '#22c55e'
                  }
                ]}>
                  {txn.type === 'debit' ? '-' : '+'}
                  ₹{txn.amount}
                </Text>
                <Text style={styles.txnBalance}>
                  ₹{txn.balance_after}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Razorpay note */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            🚀 Production Ready
          </Text>
          <Text style={styles.infoText}>
            This demo bank simulates real banking.{'\n'}
            In production, replace with:{'\n\n'}
            Load money → Razorpay Payment Gateway{'\n'}
            Cash out → Razorpay Payout API{'\n\n'}
            Razorpay handles RBI compliance,{'\n'}
            KYC, and bank connections.{'\n'}
            Integration takes ~2 days.
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: { marginBottom: 20 },
  backText: { color: '#6366f1', fontSize: 16 },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 24,
  },
  bankCard: {
    background: 'linear-gradient(135deg, #1a1a3e, #2d2b69)',
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  bankName: {
    color: '#818cf8',
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '600',
  },
  accountLabel: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  accountNumber: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 2,
  },
  balanceLabel: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  balance: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  demoNote: {
    color: '#666',
    fontSize: 11,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyBox: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  txnRow: {
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  txnDesc: {
    color: 'white',
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 13,
  },
  txnDate: {
    color: '#666',
    fontSize: 11,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  txnBalance: {
    color: '#666',
    fontSize: 11,
  },
  infoBox: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginTop: 8,
  },
  infoTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 10,
  },
  infoText: {
    color: '#888',
    lineHeight: 24,
    fontSize: 13,
  },
});