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
  const certificate = await getCertificate();
  const senderUsername = await AsyncStorage.getItem('username');
  const currentBalance = await getBalance();

  if (currentBalance < amount) {
    throw new Error(`Insufficient balance. You have ₹${currentBalance}`);
  }

  if (!certificate) {
    throw new Error('No certificate found. Please load money first.');
  }

  // Generate unique transaction ID
  const txn_id = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  const payment = {
    txn_id: txn_id,          
    type: 'PAYMENT',
    sender: senderUsername,
    receiver: receiverUsername,
    amount: amount,
    paid_at: new Date().toISOString(),
    certificate: certificate,
  };

  console.log('Payment package built, txn_id:', txn_id);
  return payment;
};

// Process incoming payment on receiver side
// Verifies it is real and updates balance
export const processIncomingPayment = async (paymentData) => {
  if (!paymentData.txn_id) throw new Error('Invalid payment: no transaction ID');
  if (!paymentData.amount) throw new Error('Invalid payment: no amount');
  if (!paymentData.sender) throw new Error('Invalid payment: no sender');

  // Check certificate expiry
  const certExpiry = new Date(paymentData.certificate.expires_at);
  const now = new Date();
  if (certExpiry < now) {
    throw new Error('Payment certificate has expired');
  }

  // Get current balance and add received amount
  const currentBalance = await getBalance();
  const newBalance = currentBalance + parseFloat(paymentData.amount);
  await saveBalance(newBalance);

  // Save transaction with all required fields
  await saveTransaction({
    txn_id: paymentData.txn_id,
    type: 'received',                      // ← important
    sender: paymentData.sender,
    receiver: paymentData.receiver,
    amount: parseFloat(paymentData.amount),
    paid_at: paymentData.paid_at || new Date().toISOString(),
    status: 'pending',
  });

  console.log('Payment received:', paymentData.amount);
  console.log('New balance:', newBalance);

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

  // Save transaction with all required fields
  await saveTransaction({
    txn_id: txnId,
    type: 'sent',                          // ← important
    sender: senderUsername,
    receiver: receiverUsername,
    amount: parseFloat(amount),
    paid_at: new Date().toISOString(),
    status: 'pending',
  });

  console.log('Balance deducted:', currentBalance, '→', newBalance);
  console.log('Transaction saved:', txnId);

  return newBalance;
};