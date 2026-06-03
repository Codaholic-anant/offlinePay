import os
import base64
import json
import razorpay
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend

# ─────────────────────────────────────────────────────
# RSA KEY SETUP
# Runs once when Django starts.
# ─────────────────────────────────────────────────────

def load_private_key_from_env():
    pem = os.environ.get('PRIVATE_KEY_PEM', '')
    if not pem:
        return None

    pem = pem.replace('\\n', '\n')
    pem = pem.replace('\r\n', '\n')
    pem = pem.strip()

    if not pem.startswith('-----'):
        try:
            pem = base64.b64decode(pem).decode('utf-8')
        except:
            pass

    try:
        key = serialization.load_pem_private_key(
            pem.encode('utf-8'),
            password=None,
            backend=default_backend()
        )
        return key
    except Exception as e:
        print(f"Key loading error: {e}")
        print(f"Key starts with: {pem[:50]}")
        return None


# ─── Razorpay client ───────────────────────────────
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
    )
else:
    razorpay_client = None
    print("WARNING: Razorpay keys not set — using mock mode")


# ─── Load or generate RSA keys ─────────────────────
_loaded_key = load_private_key_from_env()
PUBLIC_KEY_PEM_ENV = os.environ.get('PUBLIC_KEY_PEM', '')

if _loaded_key:
    private_key = _loaded_key
    public_key = private_key.public_key()
    PUBLIC_KEY_PEM = PUBLIC_KEY_PEM_ENV or public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    print("✅ Using RSA keys from environment")
else:
    print("⚠️  Generating new RSA keys (development mode)")
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

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')

    private_b64 = base64.b64encode(private_pem.encode()).decode()
    public_b64 = base64.b64encode(PUBLIC_KEY_PEM.encode()).decode()

    print("=" * 50)
    print("PRIVATE KEY BASE64 (paste to Render):")
    print(private_b64)
    print("PUBLIC KEY BASE64 (paste to Render):")
    print(public_b64)
    print("=" * 50)


def sign_data(data: dict) -> str:
    message = json.dumps(data, sort_keys=True).encode('utf-8')
    print(f"DJANGO SIGNING EXACT: {message}")
    signature = private_key.sign(
        message,
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode('utf-8')