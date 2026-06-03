from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
# Create bank account with ₹10,000 demo balance
from .models import BankAccount
# BankAccount.objects.create(user=user)
import os
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend
import json
import base64

from .models import Wallet, Transaction, WalletCertificate


# ─────────────────────────────────────────────────────
# SIGNING SETUP
# This runs once when Django starts.
# Creates a private + public key pair.
#
# Private key = only server knows it, used to SIGN
# Public key  = everyone knows it, used to VERIFY
#
# Like a stamp and a magnifying glass:
# Only you have the stamp (private key)
# Anyone can check if stamp is real (public key)
# ─────────────────────────────────────────────────────

PRIVATE_KEY_PEM = os.environ.get('PRIVATE_KEY_PEM', '')
PUBLIC_KEY_PEM_ENV = os.environ.get('PUBLIC_KEY_PEM', '')

if PRIVATE_KEY_PEM and PUBLIC_KEY_PEM_ENV:
    # Load from environment (production)
    private_key = serialization.load_pem_private_key(
        PRIVATE_KEY_PEM.encode('utf-8').replace(b'\\n', b'\n'),
        password=None,
        backend=default_backend()
    )
    public_key = private_key.public_key()
    PUBLIC_KEY_PEM = PUBLIC_KEY_PEM_ENV
    print("Using RSA keys from environment ✅")
else:
    # Generate fresh (development only)
    print("WARNING: Generating new RSA keys — development mode")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    public_key = private_key.public_key()
    PUBLIC_KEY_PEM = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')

    # Print keys so you can copy to Railway env vars
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    print("PRIVATE KEY (save to Render):")
    print(private_pem)
    print("PUBLIC KEY (save to Render):")
    print(PUBLIC_KEY_PEM)


def sign_data(data: dict) -> str:
    message = json.dumps(data, sort_keys=True).encode('utf-8')
    print(f"DJANGO SIGNING EXACT: {message}")
    signature = private_key.sign(
        message,
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode('utf-8')

# ─────────────────────────────────────────────────────
# REGISTER
# POST /api/register/
# Body: { username, password, device_id }
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Creates a new user account.
    AllowAny = no login needed to access this endpoint.
    Makes sense — you need to register before you can login.
    """
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    # Check required fields
    if not username or not password:
        return Response(
            {'error': 'Username and password are required'},
            status=status.HTTP_400_BAD_REQUEST  # 400 = bad request
        )

    # Check username not already taken
    if User.objects.filter(username=username).exists():
        return Response(
            {'error': 'Username already taken'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create the user
    # create_user hashes the password automatically
    # NEVER store plain text passwords
    user = User.objects.create_user(
        username=username,
        password=password,
    )

    # Create their wallet automatically
    # Every user gets a wallet with ₹0
    Wallet.objects.create(user=user)
    BankAccount.objects.create(user=user)

    return Response(
        {'message': f'Account created for {username}'},
        status=status.HTTP_201_CREATED  # 201 = created successfully
    )


# ─────────────────────────────────────────────────────
# GET WALLET
# GET /api/wallet/
# Header: Authorization: Bearer <access_token>
# ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    """
    Returns wallet info for logged in user.
    IsAuthenticated = must send JWT token in header.
    request.user = automatically the logged in user.
    """
    wallet = request.user.wallet

    return Response({
        'username': request.user.username,
        'issued_balance': str(wallet.issued_balance),
        'is_offline': wallet.is_offline,
        'device_id': wallet.device_id,
        # Send public key so phone can verify signatures
        'public_key': PUBLIC_KEY_PEM,
    })


# ─────────────────────────────────────────────────────
# LOAD MONEY
# POST /api/wallet/load/
# Body: { amount, device_id }
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def load_money(request):
    """
    Adds money to wallet and creates a signed certificate.

    Flow:
    1. Check amount is valid
    2. Check wallet not locked to another device
    3. Add money to wallet
    4. Create signed certificate
    5. Return certificate to phone for offline storage
    """
    amount = request.data.get('amount')
    device_id = request.data.get('device_id', '')

    # Validate amount
    if not amount:
        return Response(
            {'error': 'Amount is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        amount = Decimal(str(amount))
    except ValueError:
        return Response(
            {'error': 'Amount must be a number'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if amount <= 0:
        return Response(
            {'error': 'Amount must be greater than 0'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if amount > 10000:
        return Response(
            {'error': 'Maximum load is ₹10,000 at a time'},
            status=status.HTTP_400_BAD_REQUEST
        )

    wallet = request.user.wallet

    # KEY SECURITY CHECK
    # If wallet is already offline on a DIFFERENT device
    # block this request completely
    # This prevents the two-phone attack we discussed
    if wallet.is_offline and wallet.device_id != device_id:
        return Response(
            {
                'error': 'Wallet is active on another device.',
                'detail': 'Cash out on that device first.'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Add money to wallet
    wallet.issued_balance += amount
    wallet.is_offline = True
    wallet.device_id = device_id
    wallet.went_offline_at = timezone.now()
    wallet.save()

    # Create certificate data
    # This is what we sign — contains user info and balance
    now = timezone.now()
    expires = now + timedelta(days=7)

    cert_data = {
        'user_id': request.user.id,
        'username': request.user.username,
        'balance': float(wallet.issued_balance),
        'issued_at': now.isoformat(),
        'expires_at': expires.isoformat(),
    }

    # Sign the certificate
    signature = sign_data(cert_data)

    # Save certificate to database
    WalletCertificate.objects.create(
        wallet=wallet,
        certified_balance=wallet.issued_balance,
        signature=signature,
        expires_at=expires,
    )

    # Return everything to phone
    # Phone stores this locally for offline use
    return Response({
        'message': f'₹{amount} loaded successfully',
        'new_balance': str(wallet.issued_balance),
        'certificate': {
            'data': cert_data,
            'signature': signature,
            'expires_at': expires.isoformat(),
        },
        'public_key': PUBLIC_KEY_PEM,
    })


# ─────────────────────────────────────────────────────
# GO OFFLINE
# POST /api/wallet/go-offline/
# Body: { device_id }
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def go_offline(request):
    """
    Phone tells server: I'm going offline now.
    Server locks wallet to this device.
    No other device can load money until sync.
    """
    device_id = request.data.get('device_id', '')

    wallet = request.user.wallet
    wallet.is_offline = True
    wallet.device_id = device_id
    wallet.went_offline_at = timezone.now()
    wallet.save()

    return Response({
        'message': 'Wallet locked to this device. Safe to go offline.',
        'device_id': device_id,
    })


# ─────────────────────────────────────────────────────
# SYNC TRANSACTIONS
# POST /api/wallet/sync/
# Body: { transactions: [ {...}, {...} ] }
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_transactions(request):
    """
    Phone sends all offline transactions to server.

    For each transaction:
    - If txn_id never seen before → save it (synced)
    - If txn_id already in database → ignore it (duplicate)

    The unique=True on txn_id model field is what
    makes this safe. Database simply refuses duplicates.
    """
    transactions = request.data.get('transactions', [])

    if not transactions:
        return Response({'message': 'No transactions to sync'})

    synced = 0
    rejected = 0

    for txn in transactions:
        try:
            sender = User.objects.get(username=txn['sender'])
            receiver = User.objects.get(username=txn['receiver'])

            # get_or_create:
            # Try to find Transaction with this txn_id
            # If found → created=False (duplicate, skip)
            # If not found → created=True (new, save it)
            obj, created = Transaction.objects.get_or_create(
                txn_id=txn['txn_id'],
                defaults={
                    'sender': sender,
                    'receiver': receiver,
                    'amount': txn['amount'],
                    'status': 'synced',
                    'paid_at': txn['paid_at'],
                    'synced_at': timezone.now(),
                }
            )

            if created:
                synced += 1
            else:
                rejected += 1

        except User.DoesNotExist:
            rejected += 1
        except Exception:
            rejected += 1

    return Response({
        'synced': synced,
        'rejected_duplicates': rejected,
        'message': (
            f'{synced} new transactions saved, '
            f'{rejected} duplicates ignored'
        )
    })


# ─────────────────────────────────────────────────────
# CASH OUT
# POST /api/wallet/cashout/
# Body: { local_balance }
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cashout(request):
    """
    User wants money back in bank account.
    They tell us their current local balance.
    We verify it makes sense, then reset wallet.

    In real app → trigger actual bank transfer here.
    For learning → we just reset the balance.
    """
    local_balance = request.data.get('local_balance', 0)

    try:
        local_balance = float(local_balance)
    except ValueError:
        return Response(
            {'error': 'Invalid balance amount'},
            status=status.HTTP_400_BAD_REQUEST
        )

    wallet = request.user.wallet

    # Safety check
    # They cannot cash out MORE than what was issued
    # If they try → something fishy is happening
    if local_balance > float(wallet.issued_balance):
        return Response(
            {'error': 'Cannot cash out more than issued balance'},
            status=status.HTTP_400_BAD_REQUEST
        )

    cashed_out = local_balance

    # Reset wallet completely
    wallet.issued_balance = 0
    wallet.is_offline = False
    wallet.device_id = ''
    wallet.went_offline_at = None
    wallet.save()

    # Deactivate all certificates
    # Old pytihcertificates are now worthless
    wallet.certificates.update(is_active=False)

    return Response({
        'message': f'₹{cashed_out} cashed out successfully',
        'new_balance': '0.00',
        'note': 'In production this triggers a real bank transfer',
    })

# ─────────────────────────────────────────────────────
# REGISTER RECEIVER
# POST /api/wallet/register-receiver/
# Phone B calls this to say "I am ready to receive"
# Stores IP temporarily so Phone A can find it
# ─────────────────────────────────────────────────────

# Simple in-memory store for receiver IPs
# In production use Redis or database
active_receivers = {}

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_receiver(request):
    ip_address = request.data.get('ip_address')
    username = request.user.username

    if not ip_address:
        return Response(
            {'error': 'IP address required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Store receiver info
    active_receivers[username] = {
        'ip': ip_address,
        'registered_at': timezone.now().isoformat(),
    }

    return Response({
        'message': f'{username} registered as receiver',
        'ip': ip_address,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_receiver(request):
    username = request.query_params.get('username')

    if not username:
        return Response(
            {'error': 'Username required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    receiver = active_receivers.get(username)

    if not receiver:
        return Response(
            {'error': 'Receiver not found or not ready'},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response({
        'username': username,
        'ip': receiver['ip'],
        'registered_at': receiver['registered_at'],
    })

# Simple in-memory payment relay
# Holds payment for 60 seconds while receiver picks it up
pending_payments = {}

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_payment_relay(request):
    """
    Payer posts payment here.
    Receiver polls here to pick it up.
    Payment deleted after pickup.
    Django never processes the money —
    just holds the package temporarily.
    """
    receiver_username = request.data.get('receiver')
    payment_data = request.data.get('payment')

    if not receiver_username or not payment_data:
        return Response(
            {'error': 'receiver and payment required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Store payment for receiver to pick up
    pending_payments[receiver_username] = {
        'payment': payment_data,
        'sent_at': timezone.now().isoformat(),
        'sender': request.user.username,
    }

    return Response({
        'success': True,
        'message': 'Payment sent to relay. Waiting for receiver.',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_payment_relay(request):
    """
    Receiver polls this every 2 seconds.
    When payment arrives — picks it up and deletes it.
    """
    username = request.user.username
    payment = pending_payments.get(username)

    if not payment:
        return Response({'payment': None})

    # Delete after pickup — one time use
    del pending_payments[username]

    return Response({
        'payment': payment['payment'],
        'sender': payment['sender'],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_payment_relay(request):
    """
    Receiver confirms they got the payment.
    Sender gets this confirmation.
    """
    txn_id = request.data.get('txn_id')
    receiver = request.user.username

    # Store confirmation for sender
    pending_payments[f'confirm_{txn_id}'] = {
        'confirmed': True,
        'receiver': receiver,
        'confirmed_at': timezone.now().isoformat(),
    }

    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_confirmation_relay(request):
    """
    Sender polls this to know if receiver confirmed.
    """
    txn_id = request.query_params.get('txn_id')
    key = f'confirm_{txn_id}'
    confirmation = pending_payments.get(key)

    if not confirmation:
        return Response({'confirmed': False})

    # Delete after pickup
    del pending_payments[key]

    return Response({
        'confirmed': True,
        'receiver': confirmation['receiver'],
    })

    # ─────────────────────────────────────────────
# GET BANK ACCOUNT
# GET /api/bank/
# ─────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bank_account(request):
    try:
        account = request.user.bank_account
    except:
        from .models import BankAccount
        account = BankAccount.objects.create(user=request.user)

    transactions = account.transactions.order_by('-created_at')[:10]

    return Response({
        'account_number': account.account_number,
        'bank_name': account.bank_name,
        'balance': str(account.balance),
        'transactions': [
            {
                'type': t.transaction_type,
                'amount': str(t.amount),
                'description': t.description,
                'balance_after': str(t.balance_after),
                'date': t.created_at.isoformat(),
            }
            for t in transactions
        ]
    })


# ─────────────────────────────────────────────
# LOAD MONEY (with bank debit)
# Updated version with real bank deduction
# ─────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def load_money_from_bank(request):
    """
    Deducts from bank account and loads to wallet.
    In production — replaced by Razorpay payment.
    """
    from decimal import Decimal
    from .models import BankAccount, BankTransaction

    amount = request.data.get('amount')
    device_id = request.data.get('device_id', '')

    if not amount:
        return Response(
            {'error': 'Amount required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        amount = Decimal(str(amount))
    except:
        return Response(
            {'error': 'Invalid amount'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if amount <= 0:
        return Response(
            {'error': 'Amount must be positive'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if amount > 10000:
        return Response(
            {'error': 'Maximum ₹10,000 per load'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get bank account
    try:
        bank_account = request.user.bank_account
    except:
        bank_account = BankAccount.objects.create(user=request.user)

    # Check bank balance
    if bank_account.balance < amount:
        return Response(
            {
                'error': f'Insufficient bank balance. '
                         f'Available: ₹{bank_account.balance}'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    wallet = request.user.wallet

    # Check device lock
    if wallet.is_offline and wallet.device_id != device_id:
        return Response(
            {'error': 'Wallet active on another device'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Deduct from bank
    bank_account.balance -= amount
    bank_account.save()

    # Record bank transaction
    BankTransaction.objects.create(
        account=bank_account,
        amount=amount,
        transaction_type='debit',
        description=f'Loaded to OfflinePay wallet',
        balance_after=bank_account.balance,
    )

    # Add to wallet
    wallet.issued_balance += amount
    wallet.is_offline = True
    wallet.device_id = device_id
    wallet.went_offline_at = timezone.now()
    wallet.save()

    # Create signed certificate
    now = timezone.now()
    expires = now + timedelta(days=7)

    cert_data = {
        'balance': float(wallet.issued_balance),
        'expires_at': expires.isoformat(),
        'issued_at': now.isoformat(),
        'user_id': request.user.id,
        'username': request.user.username,
    }

    cert_data_string = json.dumps(cert_data, sort_keys=True)
    signature = sign_data(cert_data)

    WalletCertificate.objects.create(
        wallet=wallet,
        certified_balance=wallet.issued_balance,
        signature=signature,
        expires_at=expires,
    )

    return Response({
        'message': f'₹{amount} loaded from bank to wallet',
        'wallet_balance': str(wallet.issued_balance),
        'bank_balance': str(bank_account.balance),
        'new_balance': str(wallet.issued_balance),
        'certificate': {
            'data': cert_data,
            'data_string': cert_data_string,
            'signature': signature,
            'expires_at': expires.isoformat(),
        },
        'public_key': PUBLIC_KEY_PEM,
    })


# ─────────────────────────────────────────────
# CASHOUT (with bank credit)
# ─────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cashout_to_bank(request):
    """
    Credits wallet balance back to bank account.
    In production — replaced by Razorpay payout.
    """
    from decimal import Decimal
    from .models import BankAccount, BankTransaction

    local_balance = request.data.get('local_balance', 0)

    try:
        local_balance = Decimal(str(local_balance))
    except:
        return Response(
            {'error': 'Invalid balance'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if local_balance < 0:
        return Response(
            {'error': 'Balance cannot be negative'},
            status=status.HTTP_400_BAD_REQUEST
        )

    wallet = request.user.wallet

    # Get bank account
    try:
        bank_account = request.user.bank_account
    except:
        bank_account = BankAccount.objects.create(user=request.user)

    # Credit to bank
    bank_account.balance += local_balance
    bank_account.save()

    # Record bank transaction
    BankTransaction.objects.create(
        account=bank_account,
        amount=local_balance,
        transaction_type='credit',
        description='Cashed out from OfflinePay wallet',
        balance_after=bank_account.balance,
    )

    # Reset wallet
    wallet.issued_balance = 0
    wallet.is_offline = False
    wallet.device_id = ''
    wallet.went_offline_at = None
    wallet.save()

    wallet.certificates.update(is_active=False)

    return Response({
        'message': f'₹{local_balance} cashed out to bank',
        'wallet_balance': '0.00',
        'bank_balance': str(bank_account.balance),
        'new_balance': '0.00',
    })