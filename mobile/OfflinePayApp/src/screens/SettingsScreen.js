import React, { useState } from 'react';
import styles from '../styles/SettingStyles';
import { useTheme } from '../context/ThemeContext';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen({ username, onLogout, onBack }) {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const { theme, isDark, toggleTheme } = useTheme();

    const handleClearPin = () => {
        Alert.alert(
            '🔐 Reset PIN',
            'This will clear your PIN. You will need to set a new one next time.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem('wallet_pin');
                        Alert.alert('✅ Done', 'PIN has been reset.');
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: onLogout,
                },
            ]
        );
    };

    const SettingRow = ({ icon, title, subtitle, onPress, right }) => (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                    <Text style={styles.rowIcon}>{icon}</Text>
                </View>
                <View>
                    <Text style={styles.rowTitle}>{title}</Text>
                    {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
                </View>
            </View>
            <View style={styles.rowRight}>
                {right || <Text style={styles.chevron}>›</Text>}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {username?.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.profileName}>{username}</Text>
                    <Text style={styles.profileSub}>OfflinePay Wallet</Text>
                </View>

                {/* Account Section */}
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.section}>
                    <SettingRow
                        icon="👤"
                        title="Username"
                        subtitle={username}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="🔐"
                        title="Reset PIN"
                        subtitle="Change your wallet PIN"
                        onPress={handleClearPin}
                    />
                </View>

                {/* Preferences Section */}
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.section}>
                    <SettingRow
                        icon="🌙"
                        title="Dark Mode"
                        subtitle="Currently active"
                        right={
                            <Switch
                                value={isDarkMode}
                                onValueChange={setIsDarkMode}
                                trackColor={{ false: '#2a2a5e', true: '#6366f1' }}
                                thumbColor="white"
                            />
                        }
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="🔔"
                        title="Notifications"
                        subtitle="Payment alerts"
                        right={
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={setNotificationsEnabled}
                                trackColor={{ false: '#2a2a5e', true: '#6366f1' }}
                                thumbColor="white"
                            />
                        }
                    />
                </View>

                {/* Security Section */}
                <Text style={styles.sectionTitle}>Security</Text>
                <View style={styles.section}>
                    <SettingRow
                        icon="🛡️"
                        title="PIN Protection"
                        subtitle="Enabled on app open"
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="🔒"
                        title="Offline Encryption"
                        subtitle="RSA-2048 signed certificates"
                    />
                </View>

                {/* About Section */}
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.section}>
                    <SettingRow
                        icon="📱"
                        title="App Version"
                        subtitle="1.0.0"
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="🌐"
                        title="Backend"
                        subtitle="offlinepay-6k39.onrender.com"
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="💻"
                        title="Built with"
                        subtitle="React Native + Django + Razorpay"
                    />
                </View>

                <TouchableOpacity
                    style={[s.settingRow, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
                    onPress={toggleTheme}
                >
                    <Text style={[s.settingLabel, { color: theme.textPrimary }]}>
                        {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
                    </Text>
                    <Text style={[s.settingValue, { color: theme.primary }]}>
                        {isDark ? 'ON' : 'OFF'}
                    </Text>
                </TouchableOpacity>
                
                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>🚪 Logout</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

