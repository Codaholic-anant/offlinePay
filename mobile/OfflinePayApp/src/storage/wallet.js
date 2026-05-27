import AsyncStorage from '@react-native-async-storage/async-storage';

// All the keys we use to store data on phone
// Keeping them in one place avoids typos
const KEYS = {
  BALANCE: 'local_balance',
  CERTIFICATE: 'wallet_certificate',
  PUBLIC_KEY: 'public_key',
  TRANSACTIONS: 'offline_transactions',
  DEVICE_ID: 'device_id',
};

// ─────────────────────────────
// BALANCE
// ─────────────────────────────

export const saveBalance = async (balance) => {
  // Must convert number to string for AsyncStorage
  await AsyncStorage.setItem(KEYS.BALANCE, balance.toString());
};

export const getBalance = async () => {
  const balance = await AsyncStorage.getItem(KEYS.BALANCE);
  // Convert back to number when reading
  return balance ? parseFloat(balance) : 0;
};

// ─────────────────────────────
// CERTIFICATE
// Signed proof of balance from server
// ─────────────────────────────

export const saveCertificate = async (certificate) => {
  // Objects must be converted to string for storage
  await AsyncStorage.setItem(
    KEYS.CERTIFICATE,
    JSON.stringify(certificate)
  );
};

export const getCertificate = async () => {
  const cert = await AsyncStorage.getItem(KEYS.CERTIFICATE);
  // Convert back to object when reading
  return cert ? JSON.parse(cert) : null;
};

// ─────────────────────────────
// PUBLIC KEY
// Used to verify payment signatures offline
// ─────────────────────────────

export const savePublicKey = async (publicKey) => {
  await AsyncStorage.setItem(KEYS.PUBLIC_KEY, publicKey);
};

export const getPublicKey = async () => {
  return await AsyncStorage.getItem(KEYS.PUBLIC_KEY);
};

// ─────────────────────────────
// DEVICE ID
// Unique fingerprint of this phone
// ─────────────────────────────

export const saveDeviceId = async (deviceId) => {
  await AsyncStorage.setItem(KEYS.DEVICE_ID, deviceId);
};

export const getDeviceId = async () => {
  return await AsyncStorage.getItem(KEYS.DEVICE_ID);
};

// ─────────────────────────────
// TRANSACTIONS
// Payments made while offline
// ─────────────────────────────

export const saveTransaction = async (transaction) => {
  // Get existing list first
  const existing = await getTransactions();
  // Add new transaction to list
  existing.push(transaction);
  // Save entire updated list
  await AsyncStorage.setItem(
    KEYS.TRANSACTIONS,
    JSON.stringify(existing)
  );
};

export const getTransactions = async () => {
  const txns = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
  return txns ? JSON.parse(txns) : [];
};

export const clearTransactions = async () => {
  await AsyncStorage.setItem(
    KEYS.TRANSACTIONS,
    JSON.stringify([])
  );
};

// ─────────────────────────────
// CLEAR ALL
// Called on logout or cashout
// ─────────────────────────────

export const clearWalletData = async () => {
  await AsyncStorage.multiRemove([
    KEYS.BALANCE,
    KEYS.CERTIFICATE,
    KEYS.PUBLIC_KEY,
    KEYS.TRANSACTIONS,
  ]);
};