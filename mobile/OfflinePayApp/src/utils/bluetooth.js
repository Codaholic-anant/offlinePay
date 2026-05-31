import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { Platform, PermissionsAndroid } from 'react-native';
import { buildPaymentPackage, processIncomingPayment, deductBalance } from './payment';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// REQUEST PERMISSIONS
// ─────────────────────────────────────────────
export const requestBluetoothPermissions = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      console.log('Permissions:', JSON.stringify(results));
      return Object.values(results).every(
        v => v === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    console.log('Permission error:', err);
    return false;
  }
};

// ─────────────────────────────────────────────
// CHECK BLUETOOTH STATE
// ─────────────────────────────────────────────
export const checkBluetoothState = async () => {
  try {
    const enabled = await RNBluetoothClassic.isBluetoothEnabled();
    console.log('Bluetooth enabled:', enabled);
    return enabled;
  } catch (err) {
    console.log('BT state error:', err);
    return false;
  }
};

// ─────────────────────────────────────────────
// MAKE PHONE DISCOVERABLE (Merchant side)
// Phone B calls this to be visible to payers
// ─────────────────────────────────────────────
export const startAdvertising = async (username) => {
  try {
    // Request discovery for 60 seconds
    const accepted = await RNBluetoothClassic.requestBluetoothEnabled();
    console.log('Bluetooth enabled:', accepted);

    // Make device discoverable for 60 seconds
    await RNBluetoothClassic.accept({ delimiter: '\n' });
    console.log('Device is now discoverable as:', username);
    return true;
  } catch (err) {
    console.log('Discoverable error:', err);
    throw err;
  }
};

export const stopAdvertising = async () => {
  try {
    await RNBluetoothClassic.cancelAccept();
    console.log('Stopped advertising');
  } catch (err) {
    console.log('Stop advertise error:', err);
  }
};

// ─────────────────────────────────────────────
// SCAN FOR NEARBY DEVICES (Payer side)
// ─────────────────────────────────────────────
export const scanForPaymentDevices = async (onDeviceFound, onError) => {
  try {
    console.log('Starting Classic BT scan...');

    // Check if BT is enabled
    const enabled = await RNBluetoothClassic.isBluetoothEnabled();
    if (!enabled) {
      await RNBluetoothClassic.requestBluetoothEnabled();
    }

    // First check already paired devices
    const paired = await RNBluetoothClassic.getBondedDevices();
    console.log('Paired devices:', paired.length);
    paired.forEach(device => {
      console.log('Paired:', device.name, device.address);
      onDeviceFound(device);
    });

    // Then scan for new devices
    const discovering = await RNBluetoothClassic.startDiscovery();
    console.log('Discovery started:', discovering);

    // Listen for discovered devices
    const subscription = RNBluetoothClassic.onDeviceDiscovered((device) => {
      console.log('Discovered:', device.name, device.address);
      onDeviceFound(device);
    });

    // Stop after 15 seconds
    setTimeout(async () => {
      try {
        await RNBluetoothClassic.cancelDiscovery();
        subscription.remove();
        console.log('Discovery stopped');
      } catch (err) {
        console.log('Stop discovery error:', err);
      }
    }, 15000);

  } catch (err) {
    console.log('Scan error:', err.message);
    onError(err);
  }
};

export const stopScan = async () => {
  try {
    await RNBluetoothClassic.cancelDiscovery();
  } catch (err) {
    console.log('Stop scan error:', err);
  }
};

// ─────────────────────────────────────────────
// SEND PAYMENT (Payer side)
// Connect to merchant and send payment data
// ─────────────────────────────────────────────
export const sendBluetoothPayment = async (device, amount, receiverUsername) => {
  try {
    console.log('Connecting to:', device.name, device.address);

    const connection = await RNBluetoothClassic.connectToDevice(
      device.address
    );
    console.log('Connected!');

    // Build payment package
    const payment = await buildPaymentPackage(amount, receiverUsername);
    console.log('Payment built, txn_id:', payment.txn_id);

    // Send payment as JSON string
    const paymentString = JSON.stringify(payment) + '\n';
    await connection.write(paymentString);
    console.log('Payment data sent, waiting for confirmation...');

    // Wait for confirmation from merchant
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No response from merchant. Make sure receiver is on Receive screen.'));
      }, 30000);

      const subscription = connection.onDataReceived((data) => {
        clearTimeout(timeout);
        subscription.remove();
        try {
          const result = JSON.parse(data.data.trim());
          console.log('Confirmation received:', result);
          resolve(result);
        } catch (err) {
          reject(new Error('Invalid response from merchant'));
        }
      });
    });

    // Disconnect
    await connection.disconnect();
    console.log('Disconnected');

    if (response.success) {
      // Deduct balance locally ONLY after confirmed
      const newBalance = await deductBalance(
        amount,
        payment.txn_id,
        receiverUsername
      );
      return { success: true, newBalance };
    } else {
      throw new Error(response.error || 'Payment rejected by merchant');
    }

  } catch (err) {
    console.log('Payment error:', err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────
// RECEIVE PAYMENT (Merchant side)
// Listen for incoming payment from payer
// ─────────────────────────────────────────────
export const receiveBluetoothPayment = async (onPaymentReceived, onError) => {
  try {
    console.log('Waiting for payment connection...');

    // Accept incoming connection
    const device = await RNBluetoothClassic.accept({ delimiter: '\n' });
    console.log('Payer connected:', device.name);

    // Listen for payment data
    device.onDataReceived(async (data) => {
      try {
        console.log('Payment data received');
        const payment = JSON.parse(data.data);

        // Process payment
        const result = await processIncomingPayment(payment);

        // Send confirmation back to payer
        await device.write(JSON.stringify({ success: true }) + '\n');

        onPaymentReceived(result);
      } catch (err) {
        console.log('Process payment error:', err);
        await device.write(
          JSON.stringify({ success: false, error: err.message }) + '\n'
        );
        onError(err);
      }
    });

  } catch (err) {
    console.log('Receive error:', err.message);
    onError(err);
  }
};