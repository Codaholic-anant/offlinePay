import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import QRReceiveScreen from '../screens/QRReceiveScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Stack screens (navigated from home)
import BluetoothPayScreen from '../screens/BluetoothPayScreen';
import BluetoothReceiveScreen from '../screens/BluetoothReceiveScreen';
import QRScanScreen from '../screens/QRScanScreen';
import PayScreen from '../screens/PayScreen';
import BankScreen from '../screens/BankScreen';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ emoji, label, focused, theme }) {
    return (
        <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <Text style={{ fontSize: focused ? 24 : 20 }}>{emoji}</Text>
            <Text style={{
                fontSize: 10, marginTop: 2,
                color: focused ? theme.primary : theme.textMuted,
                fontWeight: focused ? '700' : '400',
            }}>
                {label}
            </Text>
        </View>
    );
}

function HomeTabs({ username, onLogout }) {
    const { theme, isDark } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: theme.bgCard,
                    borderTopColor: theme.border,
                    borderTopWidth: 1,
                    height: 70,
                    paddingBottom: 8,
                },
                tabBarShowLabel: false,
            }}
        >
            <Tab.Screen
                name="Home"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="🏠" label="Home" focused={focused} theme={theme} />
                    )
                }}
            >
                {props => <HomeScreen {...props} username={username} onLogout={onLogout} />}
            </Tab.Screen>

            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="📋" label="History" focused={focused} theme={theme} />
                    )
                }}
            />

            <Tab.Screen
                name="QRReceive"
                component={QRReceiveScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="📲" label="My QR" focused={focused} theme={theme} />
                    )
                }}
            />

            <Tab.Screen
                name="Settings"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="⚙️" label="Settings" focused={focused} theme={theme} />
                    )
                }}
            >
                {props => <SettingsScreen {...props} username={username} onLogout={onLogout} onBack={() => { }} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

export default function AppNavigator({ username, onLogout }) {
    const { theme } = useTheme();

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main">
                    {props => <HomeTabs {...props} username={username} onLogout={onLogout} />}
                </Stack.Screen>
                <Stack.Screen name="BluetoothPay">
                    {props => (
                        <BluetoothPayScreen
                            {...props}
                            onBack={() => props.navigation.goBack()}
                            onPaymentSent={(newBalance) => {
                                props.navigation.goBack();
                            }}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen name="BluetoothReceive">
                    {props => (
                        <BluetoothReceiveScreen
                            {...props}
                            onBack={() => props.navigation.goBack()}
                            onPaymentReceived={(newBalance) => {
                                props.navigation.goBack();
                            }}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen name="QRScan">
                    {props => (
                        <QRScanScreen
                            {...props}
                            onBack={() => props.navigation.goBack()}
                            onPaymentSent={(newBalance) => {
                                props.navigation.goBack();
                            }}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen name="Pay">
                    {props => (
                        <PayScreen
                            {...props}
                            onBack={() => props.navigation.goBack()}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen name="Bank">
                    {props => (
                        <BankScreen
                            {...props}
                            onBack={() => props.navigation.goBack()}
                        />
                    )}
                </Stack.Screen>
            </Stack.Navigator>
        </NavigationContainer>
    );
}