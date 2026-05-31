import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestBluetoothPermissions,
  startAdvertising,
  stopAdvertising,
  receiveBluetoothPayment,
} from '../utils/bluetooth';
import { getBalance } from '../storage';

export default function BluetoothReceiveScreen({ onBack, onPaymentReceived }) {
    const [advertising, setAdvertising] = useState(false);
    const [status, setStatus] = useState('idle');
    const [balance, setBalance] = useState(0);
    const [username, setUsername] = useState('');
    const [lastPayment, setLastPayment] = useState(null);

    useEffect(() => {
        loadData();
        return () => {
            stopAdvertising();
        };
    }, []);

    const loadData = async () => {
        const bal = await getBalance();
        setBalance(bal);
        const uname = await AsyncStorage.getItem('username');
        setUsername(uname || '');
    };

    const startReceiving = async () => {
        const hasPermissions = await requestBluetoothPermissions();
        if (!hasPermissions) {
            Alert.alert('Permissions Required', 'Grant Bluetooth permissions first.');
            return;
        }

        try {
            setStatus('advertising');
            setAdvertising(true);

            Alert.alert(
                '📡 Waiting for Payment',
                'Your phone is ready to receive.\nPayer can now connect and send payment.'
            );

            // Start receiving payments
            receiveBluetoothPayment(
                (result) => {
                    // Payment received!
                    setLastPayment(result);
                    setBalance(result.newBalance);
                    setStatus('done');
                    setAdvertising(false);
                    Alert.alert(
                        '🎉 Payment Received!',
                        `₹${result.amount} from ${result.sender}\nNew balance: ₹${result.newBalance.toFixed(2)}`
                    );
                    onPaymentReceived(result.newBalance);
                },
                (error) => {
                    setStatus('error');
                    setAdvertising(false);
                    Alert.alert('Error', error.message);
                }
            );
        } catch (error) {
            setStatus('error');
            setAdvertising(false);
            Alert.alert('Failed', error.message);
        }
    };

    const stopReceiving = async () => {
        await stopAdvertising();
        setAdvertising(false);
        setStatus('idle');
    };

    return (
        <View style={styles.container}>
            {/* Back */}
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>📥 Receive via Bluetooth</Text>
            <Text style={styles.subtitle}>
                Make your phone discoverable to nearby payers
            </Text>

            {/* Username card */}
            <View style={styles.nameCard}>
                <Text style={styles.nameLabel}>Advertising as</Text>
                <Text style={styles.nameValue}>{username}</Text>
                <Text style={styles.nameHint}>
                    Payer will see this name when scanning
                </Text>
            </View>

            {/* Balance */}
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Current Balance</Text>
                <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
            </View>

            {/* Status */}
            <View style={[
                styles.statusCard,
                advertising && styles.statusCardActive
            ]}>
                <Text style={styles.statusText}>
                    {status === 'idle' && '⚫ Not advertising'}
                    {status === 'starting' && '🟡 Starting...'}
                    {status === 'advertising' && '🟢 Visible to nearby phones'}
                    {status === 'error' && '🔴 Advertising not supported'}
                </Text>
                {advertising && (
                    <ActivityIndicator
                        color="#22c55e"
                        size="small"
                        style={{ marginTop: 8 }}
                    />
                )}
            </View>

            {/* Start/Stop button */}
            <TouchableOpacity
                style={[
                    styles.advertiseBtn,
                    advertising && styles.advertiseBtnStop
                ]}
                onPress={advertising ? stopReceiving : startReceiving}
            >
                <Text style={styles.advertiseBtnText}>
                    {advertising
                        ? '⏹  Stop Advertising'
                        : '📡  Start Advertising'}
                </Text>
            </TouchableOpacity>

            {/* Last payment */}
            {lastPayment && (
                <View style={styles.paymentCard}>
                    <Text style={styles.paymentTitle}>✅ Payment Received!</Text>
                    <Text style={styles.paymentAmount}>+₹{lastPayment.amount}</Text>
                    <Text style={styles.paymentFrom}>From: {lastPayment.sender}</Text>
                </View>
            )}

            {/* Info */}
            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>How it works</Text>
                <Text style={styles.infoText}>
                    1. Tap "Start Advertising"{'\n'}
                    2. Your phone becomes discoverable{'\n'}
                    3. Payer scans and finds you{'\n'}
                    4. Payer sends payment{'\n'}
                    5. You receive instantly ✅{'\n'}
                    {'\n'}
                    Note: Both phones need Bluetooth ON.{'\n'}
                    Keep phones within 10 metres.
                </Text>
            </View>
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
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: '#888',
        fontSize: 13,
        marginBottom: 24,
    },
    nameCard: {
        backgroundColor: '#1e1b4b',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#6366f1',
        marginBottom: 16,
    },
    nameLabel: {
        color: '#818cf8',
        fontSize: 12,
        marginBottom: 6,
    },
    nameValue: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    nameHint: {
        color: '#666',
        fontSize: 12,
    },
    balanceCard: {
        backgroundColor: '#1a1a3e',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2a2a5e',
        marginBottom: 16,
    },
    balanceLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 4,
    },
    balanceAmount: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
    },
    statusCard: {
        backgroundColor: '#1a1a3e',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2a2a5e',
        marginBottom: 16,
    },
    statusCardActive: {
        borderColor: '#22c55e',
        backgroundColor: '#052e16',
    },
    statusText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    advertiseBtn: {
        backgroundColor: '#6366f1',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
    },
    advertiseBtnStop: {
        backgroundColor: '#7f1d1d',
    },
    advertiseBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    paymentCard: {
        backgroundColor: '#052e16',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#22c55e',
        marginBottom: 16,
    },
    paymentTitle: {
        color: '#22c55e',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 8,
    },
    paymentAmount: {
        color: '#22c55e',
        fontSize: 40,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    paymentFrom: {
        color: '#888',
        fontSize: 14,
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
        lineHeight: 24,
        fontSize: 13,
    },
});