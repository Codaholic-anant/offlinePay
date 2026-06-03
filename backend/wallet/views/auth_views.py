from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from ..models import Wallet, BankAccount


# ─────────────────────────────────────────────────────
# REGISTER
# POST /api/register/
# Body: { username, password }
# ─────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not username or not password:
        return Response(
            {'error': 'Username and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {'error': 'Username already taken'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.create_user(
        username=username,
        password=password,
    )

    Wallet.objects.create(user=user)
    BankAccount.objects.create(user=user)

    return Response(
        {'message': f'Account created for {username}'},
        status=status.HTTP_201_CREATED
    )