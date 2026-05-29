import { getCertificate, getBalance, saveBalance, saveTransaction } from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Generate a unique transaction ID
// Every payment gets a unique ID
// This prevents double spending
export const generateTxnId = () => {
  return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Build payment package to send to merchant
// This is what travels over WiFi/Bluetooth
export const buildPaymentPackage = async (amount, receiverUsername) => {
  // Get certificate from local storage
  const certificate = await getCertificate();
  const senderUsername = await AsyncStorage.getItem('username');
  const currentBalance = await getBalance();

  // Check we have enough money
  if (currentBalance < amount) {
    throw new Error(`Insufficient balance. You have ₹${currentBalance}`);
  }

  // Check certificate exists
  if (!certificate) {
    throw new Error('No certificate found. Please load money first.');
  }

  // Build the payment package
  const payment = {
    type: 'PAYMENT',
    txn_id: generateTxnId(),
    sender: senderUsername,
    receiver: receiverUsername,
    amount: amount,
    paid_at: new Date().toISOString(),
    certificate: certificate,
  };

  return payment;
};

// Process incoming payment on receiver side
// Verifies it is real and updates balance
export const processIncomingPayment = async (paymentData) => {
  // Basic validation
  if (!paymentData.txn_id) throw new Error('Invalid payment: no transaction ID');
  if (!paymentData.amount) throw new Error('Invalid payment: no amount');
  if (!paymentData.sender) throw new Error('Invalid payment: no sender');
  if (!paymentData.certificate) throw new Error('Invalid payment: no certificate');

  // Check certificate is not expired
  const certExpiry = new Date(paymentData.certificate.expires_at);
  const now = new Date();
  if (certExpiry < now) {
    throw new Error('Payment certificate has expired');
  }

  // Check amount matches certificate balance
  // Sender cannot send more than their certified balance
  const certBalance = paymentData.certificate.data.balance;
  if (paymentData.amount > certBalance) {
    throw new Error('Payment amount exceeds certified balance');
  }

  // Get our current balance
  const currentBalance = await getBalance();

  // Add received amount to our balance
  const newBalance = currentBalance + parseFloat(paymentData.amount);
  await saveBalance(newBalance);

  // Save transaction locally for sync later
  await saveTransaction({
    txn_id: paymentData.txn_id,
    type: 'received',
    sender: paymentData.sender,
    receiver: paymentData.receiver,
    amount: paymentData.amount,
    paid_at: paymentData.paid_at,
    status: 'pending',
  });

  return {
    success: true,
    newBalance: newBalance,
    amount: paymentData.amount,
    sender: paymentData.sender,
  };
};

// Deduct amount from sender balance
// Called after payment is confirmed by receiver
export const deductBalance = async (amount, txnId, receiverUsername) => {
  const currentBalance = await getBalance();
  const senderUsername = await AsyncStorage.getItem('username');
  const newBalance = currentBalance - parseFloat(amount);

  // Save new balance
  await saveBalance(newBalance);

  // Save transaction locally
  await saveTransaction({
    txn_id: txnId,
    type: 'sent',
    sender: senderUsername,
    receiver: receiverUsername,
    amount: amount,
    paid_at: new Date().toISOString(),
    status: 'pending',
  });

  return newBalance;
};