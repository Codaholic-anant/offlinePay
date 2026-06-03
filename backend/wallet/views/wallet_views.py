from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import json

from ..models import Wallet, Transaction, WalletCertificate, BankAccount, BankTransaction
from .crypto_setup import sign_data, PUBLIC_KEY_PEM


# ─────────────────────────────────────────────────────
# GET WALLET
# GET /api/wallet/
# ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    wallet = request.user.wallet
    return Response({
        'username': request.user.username,
        'issued_balance': str(wallet.issued_balance),
        'is_offline': wallet.is_offline,
        'device_id': wallet.device_id,
        'public_key': PUBLIC_KEY_PEM,
    })


# ─────────────────────────────────────────────────────
# LOAD MONEY
# POST /api/wallet/load/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def load_money(request):
    amount = request.data.get('amount')
    device_id = request.data.get('device_id', '')

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
        return Response({'error': 'Amount must be greater than 0'}, status=400)

    if amount > 10000:
        return Response({'error': 'Maximum load is ₹10,000 at a time'}, status=400)

    wallet = request.user.wallet

    if wallet.is_offline and wallet.device_id != device_id:
        return Response(
            {'error': 'Wallet is active on another device.', 'detail': 'Cash out on that device first.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    wallet.issued_balance += amount
    wallet.is_offline = True
    wallet.device_id = device_id
    wallet.went_offline_at = timezone.now()
    wallet.save()

    now = timezone.now()
    expires = now + timedelta(days=7)

    cert_data = {
        'user_id': request.user.id,
        'username': request.user.username,
        'balance': float(wallet.issued_balance),
        'issued_at': now.isoformat(),
        'expires_at': expires.isoformat(),
    }

    signature = sign_data(cert_data)

    WalletCertificate.objects.create(
        wallet=wallet,
        certified_balance=wallet.issued_balance,
        signature=signature,
        expires_at=expires,
    )

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
# LOAD MONEY FROM BANK
# POST /api/wallet/load-from-bank/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def load_money_from_bank(request):
    amount = request.data.get('amount')
    device_id = request.data.get('device_id', '')

    if not amount:
        return Response({'error': 'Amount required'}, status=400)

    try:
        amount = Decimal(str(amount))
    except:
        return Response({'error': 'Invalid amount'}, status=400)

    if amount <= 0:
        return Response({'error': 'Amount must be positive'}, status=400)

    if amount > 10000:
        return Response({'error': 'Maximum ₹10,000 per load'}, status=400)

    try:
        bank_account = request.user.bank_account
    except:
        bank_account = BankAccount.objects.create(user=request.user)

    if bank_account.balance < amount:
        return Response(
            {'error': f'Insufficient bank balance. Available: ₹{bank_account.balance}'},
            status=400
        )

    wallet = request.user.wallet

    if wallet.is_offline and wallet.device_id != device_id:
        return Response({'error': 'Wallet active on another device'}, status=400)

    bank_account.balance -= amount
    bank_account.save()

    BankTransaction.objects.create(
        account=bank_account,
        amount=amount,
        transaction_type='debit',
        description='Loaded to OfflinePay wallet',
        balance_after=bank_account.balance,
    )

    wallet.issued_balance += amount
    wallet.is_offline = True
    wallet.device_id = device_id
    wallet.went_offline_at = timezone.now()
    wallet.save()

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


# ─────────────────────────────────────────────────────
# GO OFFLINE
# POST /api/wallet/go-offline/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def go_offline(request):
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
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_transactions(request):
    transactions = request.data.get('transactions', [])

    if not transactions:
        return Response({'message': 'No transactions to sync'})

    synced = 0
    rejected = 0

    for txn in transactions:
        try:
            sender = User.objects.get(username=txn['sender'])
            receiver = User.objects.get(username=txn['receiver'])

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
        'message': f'{synced} new transactions saved, {rejected} duplicates ignored'
    })


# ─────────────────────────────────────────────────────
# CASHOUT
# POST /api/wallet/cashout/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cashout(request):
    local_balance = request.data.get('local_balance', 0)

    try:
        local_balance = float(local_balance)
    except ValueError:
        return Response({'error': 'Invalid balance amount'}, status=400)

    wallet = request.user.wallet

    if local_balance > float(wallet.issued_balance):
        return Response({'error': 'Cannot cash out more than issued balance'}, status=400)

    wallet.issued_balance = 0
    wallet.is_offline = False
    wallet.device_id = ''
    wallet.went_offline_at = None
    wallet.save()
    wallet.certificates.update(is_active=False)

    return Response({
        'message': f'₹{local_balance} cashed out successfully',
        'new_balance': '0.00',
        'note': 'In production this triggers a real bank transfer',
    })


# ─────────────────────────────────────────────────────
# CASHOUT TO BANK
# POST /api/wallet/cashout-to-bank/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cashout_to_bank(request):
    local_balance = request.data.get('local_balance', 0)

    try:
        local_balance = Decimal(str(local_balance))
    except:
        return Response({'error': 'Invalid balance'}, status=400)

    if local_balance < 0:
        return Response({'error': 'Balance cannot be negative'}, status=400)

    wallet = request.user.wallet

    try:
        bank_account = request.user.bank_account
    except:
        bank_account = BankAccount.objects.create(user=request.user)

    bank_account.balance += local_balance
    bank_account.save()

    BankTransaction.objects.create(
        account=bank_account,
        amount=local_balance,
        transaction_type='credit',
        description='Cashed out from OfflinePay wallet',
        balance_after=bank_account.balance,
    )

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