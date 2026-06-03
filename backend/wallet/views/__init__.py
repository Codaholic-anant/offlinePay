# views/__init__.py
# Imports all views so urls.py can use: from .views import register, get_wallet, etc.
 
from .auth_views import register
from .wallet_views import (
    get_wallet,
    load_money,
    load_money_from_bank,
    go_offline,
    sync_transactions,
    cashout,
    cashout_to_bank,
)
from .payment_views import (
    create_payment_order,
    verify_payment,
    razorpay_cashout,
)
from .relay_views import (
    register_receiver,
    get_receiver,
    send_payment_relay,
    check_payment_relay,
    confirm_payment_relay,
    check_confirmation_relay,
)
from .bank_views import get_bank_account