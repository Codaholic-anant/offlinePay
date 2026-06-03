import styles from '../styles/BluetoothReceiveStyles';
import React, { useState, useEffect } from 'react';
// import { testFakePayment } from '../utils/payment';
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

            {/* <TouchableOpacity
                style={{
                    backgroundColor: 'red',
                    padding: 15,
                    borderRadius: 10,
                    marginTop: 20,
                }}
                onPress={testFakePayment}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>
                    TEST SECURITY
                </Text>
            </TouchableOpacity> */}

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

