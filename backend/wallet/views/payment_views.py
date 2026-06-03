from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import json

from ..models import Wallet, WalletCertificate, BankAccount, BankTransaction
from .crypto_setup import sign_data, PUBLIC_KEY_PEM, razorpay_client, RAZORPAY_KEY_ID


# ─────────────────────────────────────────────────────
# CREATE RAZORPAY ORDER
# POST /api/payment/create-order/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_order(request):
    amount = request.data.get('amount')

    if not amount:
        return Response({'error': 'Amount required'}, status=400)

    try:
        amount_paise = int(float(amount) * 100)
    except:
        return Response({'error': 'Invalid amount'}, status=400)

    if razorpay_client is None:
        return Response({
            'order_id': 'mock_order_' + str(timezone.now().timestamp()),
            'amount': amount_paise,
            'currency': 'INR',
            'key_id': 'mock_key',
            'mock': True,
        })

    order = razorpay_client.order.create({
        'amount': amount_paise,
        'currency': 'INR',
        'payment_capture': 1,
        'notes': {
            'user_id': str(request.user.id),
            'username': request.user.username,
        }
    })

    return Response({
        'order_id': order['id'],
        'amount': amount_paise,
        'currency': 'INR',
        'key_id': RAZORPAY_KEY_ID,
        'mock': False,
    })


# ─────────────────────────────────────────────────────
# VERIFY RAZORPAY PAYMENT
# POST /api/payment/verify/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    payment_id = request.data.get('razorpay_payment_id')
    order_id = request.data.get('razorpay_order_id')
    signature = request.data.get('razorpay_signature')
    amount = request.data.get('amount')
    device_id = request.data.get('device_id', '')
    is_mock = request.data.get('mock', False)

    if not is_mock:
        try:
            razorpay_client.utility.verify_payment_signature({
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature,
            })
        except Exception:
            return Response({'error': 'Payment verification failed'}, status=400)

    amount_decimal = Decimal(str(float(amount) / 100))
    wallet = request.user.wallet

    if wallet.is_offline and wallet.device_id != device_id:
        return Response({'error': 'Wallet active on another device'}, status=400)

    wallet.issued_balance += amount_decimal
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
    signature_cert = sign_data(cert_data)

    WalletCertificate.objects.create(
        wallet=wallet,
        certified_balance=wallet.issued_balance,
        signature=signature_cert,
        expires_at=expires,
    )

    return Response({
        'message': f'₹{amount_decimal} loaded successfully',
        'new_balance': str(wallet.issued_balance),
        'certificate': {
            'data': cert_data,
            'data_string': cert_data_string,
            'signature': signature_cert,
            'expires_at': expires.isoformat(),
        },
        'public_key': PUBLIC_KEY_PEM,
    })


# ─────────────────────────────────────────────────────
# RAZORPAY CASHOUT
# POST /api/payment/cashout/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def razorpay_cashout(request):
    local_balance = request.data.get('local_balance', 0)
    account_number = request.data.get('account_number', '')
    ifsc = request.data.get('ifsc', '')

    try:
        local_balance = Decimal(str(local_balance))
    except:
        return Response({'error': 'Invalid balance'}, status=400)

    wallet = request.user.wallet

    if razorpay_client is None or not account_number:
        try:
            bank_account = request.user.bank_account
            bank_account.balance += local_balance
            bank_account.save()

            BankTransaction.objects.create(
                account=bank_account,
                amount=local_balance,
                transaction_type='credit',
                description='Cashed out from OfflinePay wallet (mock)',
                balance_after=bank_account.balance,
            )
        except:
            pass

        wallet.issued_balance = 0
        wallet.is_offline = False
        wallet.device_id = ''
        wallet.save()
        wallet.certificates.update(is_active=False)

        return Response({
            'message': f'₹{local_balance} cashed out (mock)',
            'new_balance': '0.00',
            'bank_balance': str(
                request.user.bank_account.balance
                if hasattr(request.user, 'bank_account') else 0
            ),
        })

    try:
        amount_paise = int(float(local_balance) * 100)

        payout = razorpay_client.payout.create({
            'account_number': '2323230060659370',
            'fund_account': {
                'account_type': 'bank_account',
                'bank_account': {
                    'name': request.user.username,
                    'ifsc': ifsc,
                    'account_number': account_number,
                },
                'contact': {
                    'name': request.user.username,
                    'type': 'customer',
                }
            },
            'amount': amount_paise,
            'currency': 'INR',
            'mode': 'IMPS',
            'purpose': 'payout',
            'narration': 'OfflinePay cashout',
        })

        wallet.issued_balance = 0
        wallet.is_offline = False
        wallet.device_id = ''
        wallet.save()
        wallet.certificates.update(is_active=False)

        return Response({
            'message': f'₹{local_balance} sent to your bank',
            'payout_id': payout['id'],
            'new_balance': '0.00',
        })

    except Exception as e:
        return Response({'error': str(e)}, status=400)