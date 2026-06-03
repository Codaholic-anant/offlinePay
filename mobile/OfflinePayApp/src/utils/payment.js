import { getCertificate, getBalance, saveBalance, saveTransaction, getPublicKey } from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { RSA } from 'react-native-rsa-native';
import forge from 'node-forge';

// Generate a unique transaction ID
// Every payment gets a unique ID
// This prevents double spending
export const generateTxnId = () => {
  return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

export const verifyCertificate = async (certificate) => {
  try {
    const publicKey = await getPublicKey();

    if (!publicKey) {
      console.log('No public key stored');
      return false;
    }

    const certData = certificate.data;

    // Reproduce EXACTLY what Python's json.dumps outputs
    // Python json.dumps(data, sort_keys=True) produces:
    // - Keys sorted alphabetically
    // - Space after colon: "key": value
    // - Space after comma: value, value
    // - Floats keep decimal: 1000.0 not 1000

    const sortedKeys = Object.keys(certData).sort();

    // Build string manually to match Python exactly
    const parts = sortedKeys.map(key => {
      let value = certData[key];

      // Match Python's float format
      // Python outputs 1000.0 for float fields
      // balance is always a float in Python
      if (key === 'balance') {
        value = parseFloat(value);
        // Add .0 if it's a whole number
        if (Number.isInteger(value)) {
          return `"${key}": ${value}.0`;
        }
        return `"${key}": ${value}`;
      }

      // Numbers (user_id) stay as integers
      if (key === 'user_id') {
        return `"${key}": ${parseInt(value)}`;
      }

      // Strings get quoted
      return `"${key}": "${value}"`;
    });

    // Python uses ", " between items (comma + space)
    const dataToVerify = '{' + parts.join(', ') + '}';

    console.log('Python-format data:', dataToVerify);
    console.log('Signature first 20:', certificate.signature?.substring(0, 20));

    // Verify with forge
    const pubKey = forge.pki.publicKeyFromPem(publicKey);
    const signatureBytes = forge.util.decode64(certificate.signature);
    const md = forge.md.sha256.create();
    md.update(dataToVerify, 'utf8');
    const isValid = pubKey.verify(md.digest().bytes(), signatureBytes);

    console.log('Verification result:', isValid);
    return isValid;

  } catch (err) {
    console.log('Verification error:', err.message);
    return false;
  }
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
  // Basic checks
  if (!paymentData.txn_id) throw new Error('Invalid: no transaction ID');
  if (!paymentData.amount) throw new Error('Invalid: no amount');
  if (!paymentData.sender) throw new Error('Invalid: no sender');
  if (!paymentData.certificate) throw new Error('Invalid: no certificate');

  // ─────────────────────────────────────
  // STEP 1 — VERIFY RSA SIGNATURE
  // Fake certificates fail here
  // ─────────────────────────────────────
  console.log('Verifying certificate signature...');
  const isValid = await verifyCertificate(paymentData.certificate);

  if (!isValid) {
    throw new Error(
      '❌ REJECTED: Invalid certificate signature.\n' +
      'This payment may be fraudulent.'
    );
  }
  console.log('✅ Signature verified');

  // ─────────────────────────────────────
  // STEP 2 — CHECK NOT EXPIRED
  // ─────────────────────────────────────
  const expiry = new Date(paymentData.certificate.expires_at);
  if (expiry < new Date()) {
    throw new Error('❌ REJECTED: Certificate expired.');
  }
  console.log('✅ Certificate not expired');

  // ─────────────────────────────────────
  // STEP 3 — AMOUNT ≤ CERTIFIED BALANCE
  // ─────────────────────────────────────
  const certBalance = parseFloat(paymentData.certificate.data.balance);
  const payAmount = parseFloat(paymentData.amount);

  if (payAmount > certBalance) {
    throw new Error(
      `❌ REJECTED: Amount ₹${payAmount} exceeds certified balance ₹${certBalance}`
    );
  }
  console.log('✅ Amount valid');

  // ─────────────────────────────────────
  // STEP 4 — SENDER MATCHES CERTIFICATE
  // ─────────────────────────────────────
  if (paymentData.certificate.data.username !== paymentData.sender) {
    throw new Error('❌ REJECTED: Sender does not match certificate.');
  }
  console.log('✅ Sender verified');

  // ─────────────────────────────────────
  // ALL CHECKS PASSED — ACCEPT PAYMENT
  // ─────────────────────────────────────
  const currentBalance = await getBalance();
  const newBalance = currentBalance + payAmount;
  await saveBalance(newBalance);

  await saveTransaction({
    txn_id: paymentData.txn_id,
    type: 'received',
    sender: paymentData.sender,
    receiver: paymentData.receiver,
    amount: payAmount,
    paid_at: paymentData.paid_at || new Date().toISOString(),
    status: 'pending',
  });

  console.log('✅ Payment accepted! New balance:', newBalance);

  return {
    success: true,
    newBalance,
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

// // SECURITY TEST — remove after testing
// export const testFakePayment = async () => {
//   const fakePayment = {
//     txn_id: 'fake_123',
//     sender: 'hacker',
//     receiver: 'merchant',
//     amount: 99999,
//     paid_at: new Date().toISOString(),
//     certificate: {
//       data: {
//         user_id: 1,
//         username: 'hacker',
//         balance: 99999,
//         issued_at: new Date().toISOString(),
//         expires_at: new Date(Date.now() + 86400000).toISOString(),
//       },
//       signature: 'this_is_a_fake_signature',
//       expires_at: new Date(Date.now() + 86400000).toISOString(),
//     },
//   };

//   try {
//     await processIncomingPayment(fakePayment);
//     console.log('SECURITY FAIL — fake payment accepted!');
//   } catch (err) {
//     console.log('SECURITY PASS — fake payment rejected:', err.message);
//   }
// };