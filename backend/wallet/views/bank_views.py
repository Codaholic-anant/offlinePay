from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import BankAccount


# ─────────────────────────────────────────────────────
# GET BANK ACCOUNT
# GET /api/bank/
# ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bank_account(request):
    try:
        account = request.user.bank_account
    except:
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