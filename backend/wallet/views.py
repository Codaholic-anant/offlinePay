from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend
from decimal import Decimal
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


def sign_data(data: dict) -> str:
    """
    Takes a dictionary like:
    { 'username': 'ram', 'balance': 500 }

    Converts to JSON string, then signs it.
    Returns a long string of random-looking characters.
    That string is the signature — proof server made this.
    """
    message = json.dumps(data, sort_keys=True).encode('utf-8')
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