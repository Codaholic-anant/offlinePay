from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from . import views

# Every URL our phone app will call
urlpatterns = [

    # ── AUTH ──────────────────────────────────────
    # POST /api/register/ → create new account
    path('register/', views.register, name='register'),

    # POST /api/login/ → get access + refresh token
    # TokenObtainPairView is built into simplejwt
    # send: { username, password }
    # get back: { access, refresh }
    path('login/', TokenObtainPairView.as_view(), name='login'),

    # POST /api/token/refresh/ → get new access token
    # send: { refresh }
    # get back: { access }
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ── WALLET ────────────────────────────────────
    # GET /api/wallet/ → see your balance
    path('wallet/', views.get_wallet, name='get_wallet'),

    # POST /api/wallet/load/ → add money to wallet
    path('wallet/load/', views.load_money, name='load_money'),

    # POST /api/wallet/go-offline/ → lock wallet to device
    path('wallet/go-offline/', views.go_offline, name='go_offline'),

    # POST /api/wallet/sync/ → upload offline transactions
    path('wallet/sync/', views.sync_transactions, name='sync'),

    # POST /api/wallet/cashout/ → send money back to bank
    path('wallet/cashout/', views.cashout, name='cashout'),
]