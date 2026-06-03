from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth.models import User
import uuid


class Wallet(models.Model):
    """
    Think of this like a bank account record.
    Every user gets exactly ONE wallet.
    
    When user loads money and goes offline:
    - is_offline becomes True
    - device_id stores which phone has the money
    - Nobody else can load money until they come back online
    """

    # OneToOneField means one user = one wallet, no more
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,  # if user deleted, wallet deleted too
        related_name='wallet'
    )

    # How much money server officially issued to this wallet
    issued_balance = models.DecimalField(
        max_digits=10,    # up to 99,99,999.99
        decimal_places=2, # paise level accuracy
        default=0.00
    )

    # Is the wallet currently being used offline?
    # True = locked to one phone, nobody else can use it
    is_offline = models.BooleanField(default=False)

    # Unique ID of the phone holding the wallet
    # Like a phone fingerprint
    device_id = models.CharField(max_length=255, blank=True)

    went_offline_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — ₹{self.issued_balance}"


class Transaction(models.Model):
    """
    Every payment between two people.
    
    Created on the PHONE while offline.
    Uploaded to server when internet is available.
    
    The txn_id is unique — if same transaction
    is uploaded twice, server ignores the duplicate.
    This is our main double-spend protection.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending Sync'),  # on phone, not synced yet
        ('synced', 'Synced'),         # uploaded to server
        ('rejected', 'Rejected'),     # duplicate or invalid
    ]

    # UUID = universally unique ID
    # Generated on phone before sending payment
    # Example: 550e8400-e29b-41d4-a716-446655440000
    txn_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,  # database rejects duplicates automatically
        editable=False
    )

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_transactions'
    )

    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_transactions'
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # When payment happened on the phone (offline time)
    paid_at = models.DateTimeField()

    # When it was uploaded to server
    synced_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"{self.sender.username} → "
            f"{self.receiver.username} "
            f"₹{self.amount} [{self.status}]"
        )


class WalletCertificate(models.Model):
    """
    A signed document that proves how much money
    someone has in their wallet.
    
    Server creates this and signs it with a private key.
    Phone stores it locally.
    When paying, phone sends this certificate.
    Receiver verifies the signature — no internet needed.
    
    Like a cheque signed by the bank itself.
    """

    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name='certificates'
    )

    # The balance this certificate proves
    certified_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    # Server's digital signature
    # Proves this certificate is real and not faked
    signature = models.TextField()

    # Certificate stops being valid after this time
    # Prevents very old certificates being used
    expires_at = models.DateTimeField()

    # Only one active certificate per wallet at a time
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"Certificate: {self.wallet.user.username} "
            f"₹{self.certified_balance}"
        )
    
    
# Create bank account with ₹10,000 demo balance
class BankAccount(models.Model):
    """
    Simulated bank account.
    In production — replaced by Razorpay.
    Shows complete money flow for demo.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='bank_account'
    )

    # Simulated bank balance
    balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=10000.00  # Everyone starts with ₹10,000
    )

    account_number = models.CharField(
        max_length=20,
        unique=True,
        blank=True
    )

    bank_name = models.CharField(
        max_length=100,
        default='OfflinePay Demo Bank'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.account_number:
            import random
            self.account_number = ''.join(
                [str(random.randint(0, 9)) for _ in range(16)]
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} — ₹{self.balance}"


class BankTransaction(models.Model):
    """
    Records every bank transaction.
    Load money = debit from bank.
    Cash out = credit to bank.
    """
    TYPE_CHOICES = [
        ('debit', 'Debit'),   # money left bank → wallet
        ('credit', 'Credit'), # money came back → bank
    ]

    account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name='transactions'
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    description = models.CharField(max_length=255)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.transaction_type} ₹{self.amount} — {self.description}"