from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

# ─────────────────────────────────────────────────────
# IN-MEMORY STORES
# In production use Redis or database
# ─────────────────────────────────────────────────────
active_receivers = {}
pending_payments = {}


# ─────────────────────────────────────────────────────
# REGISTER RECEIVER
# POST /api/wallet/register-receiver/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_receiver(request):
    ip_address = request.data.get('ip_address')
    username = request.user.username

    if not ip_address:
        return Response({'error': 'IP address required'}, status=400)

    active_receivers[username] = {
        'ip': ip_address,
        'registered_at': timezone.now().isoformat(),
    }

    return Response({
        'message': f'{username} registered as receiver',
        'ip': ip_address,
    })


# ─────────────────────────────────────────────────────
# GET RECEIVER
# GET /api/wallet/get-receiver/
# ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_receiver(request):
    username = request.query_params.get('username')

    if not username:
        return Response({'error': 'Username required'}, status=400)

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


# ─────────────────────────────────────────────────────
# SEND PAYMENT RELAY
# POST /api/wallet/send-relay/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_payment_relay(request):
    receiver_username = request.data.get('receiver')
    payment_data = request.data.get('payment')

    if not receiver_username or not payment_data:
        return Response({'error': 'receiver and payment required'}, status=400)

    pending_payments[receiver_username] = {
        'payment': payment_data,
        'sent_at': timezone.now().isoformat(),
        'sender': request.user.username,
    }

    return Response({
        'success': True,
        'message': 'Payment sent to relay. Waiting for receiver.',
    })


# ─────────────────────────────────────────────────────
# CHECK PAYMENT RELAY
# GET /api/wallet/check-relay/
# ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_payment_relay(request):
    username = request.user.username
    payment = pending_payments.get(username)

    if not payment:
        return Response({'payment': None})

    del pending_payments[username]

    return Response({
        'payment': payment['payment'],
        'sender': payment['sender'],
    })


# ─────────────────────────────────────────────────────
# CONFIRM PAYMENT RELAY
# POST /api/wallet/confirm-relay/
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_payment_relay(request):
    txn_id = request.data.get('txn_id')
    receiver = request.user.username

    pending_payments[f'confirm_{txn_id}'] = {
        'confirmed': True,
        'receiver': receiver,
        'confirmed_at': timezone.now().isoformat(),
    }

    return Response({'success': True})


# ─────────────────────────────────────────────────────
# CHECK CONFIRMATION RELAY
# GET /api/wallet/check-confirm/
# ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_confirmation_relay(request):
    txn_id = request.query_params.get('txn_id')
    key = f'confirm_{txn_id}'
    confirmation = pending_payments.get(key)

    if not confirmation:
        return Response({'confirmed': False})

    del pending_payments[key]

    return Response({
        'confirmed': True,
        'receiver': confirmation['receiver'],
    })