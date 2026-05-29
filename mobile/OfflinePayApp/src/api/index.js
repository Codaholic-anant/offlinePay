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


// Auto refresh token when it expires
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refresh = await AsyncStorage.getItem('refresh_token');

        if (refresh) {
          // Get new access token
          const res = await axios.post(
            `${BASE_URL}/token/refresh/`,
            { refresh },
            {
              headers: {
                'ngrok-skip-browser-warning': 'true'
              }
            }
          );

          // Save new token
          await AsyncStorage.setItem('access_token', res.data.access);

          // Retry original request with new token
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        }
      } catch {
        // Refresh failed — logout
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'username']);
      }
    }

    return Promise.reject(error);
  }
);
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