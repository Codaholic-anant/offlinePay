import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// YOUR ngrok URL — this is how phone talks to Django
// Update this every time you restart ngrok
const BASE_URL = 'https://outreach-doorstep-splatter.ngrok-free.dev/api';

// Create axios instance
// Like a pre-configured phone that knows the server address
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // ngrok needs this header otherwise it shows warning page
    'ngrok-skip-browser-warning': 'true',
  },
});

// This runs before EVERY request automatically
// Adds the login token so server knows who we are
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────
// AUTH
// ─────────────────────────────

export const registerUser = async (username, password) => {
  const response = await api.post('/register/', { username, password });
  return response.data;
};

export const loginUser = async (username, password) => {
  const response = await api.post('/login/', { username, password });

  // Save tokens on phone storage
  await AsyncStorage.setItem('access_token', response.data.access);
  await AsyncStorage.setItem('refresh_token', response.data.refresh);
  await AsyncStorage.setItem('username', username);

  return response.data;
};

export const logoutUser = async () => {
  await AsyncStorage.removeItem('access_token');
  await AsyncStorage.removeItem('refresh_token');
  await AsyncStorage.removeItem('username');
};

// ─────────────────────────────
// WALLET
// ─────────────────────────────

export const getWallet = async () => {
  const response = await api.get('/wallet/');
  return response.data;
};

export const loadMoney = async (amount, deviceId) => {
  const response = await api.post('/wallet/load/', {
    amount,
    device_id: deviceId,
  });
  return response.data;
};

export const goOffline = async (deviceId) => {
  const response = await api.post('/wallet/go-offline/', {
    device_id: deviceId,
  });
  return response.data;
};

export const syncTransactions = async (transactions) => {
  const response = await api.post('/wallet/sync/', { transactions });
  return response.data;
};

export const cashout = async (localBalance) => {
  const response = await api.post('/wallet/cashout/', {
    local_balance: localBalance,
  });
  return response.data;
};

export default api;