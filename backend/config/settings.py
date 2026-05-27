from pathlib import Path
from datetime import timedelta

# This means: "the backend folder"
# Path(__file__) = this file (settings.py)
# .parent = config folder
# .parent again = backend folder
BASE_DIR = Path(__file__).resolve().parent.parent

# Secret key — Django uses this to encrypt things
# In real production app, keep this secret and long
SECRET_KEY = 'offlinepay-dev-secret-key-change-later'

# True means show detailed errors — only for learning
# In real app set this to False
DEBUG = True

# '*' means accept requests from any IP address
# This lets our phone connect to Django over WiFi
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    # Django's built in apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Packages we installed via pip
    'rest_framework',        # helps build APIs easily
    'rest_framework_simplejwt',  # handles login tokens
    'corsheaders',           # lets phone app talk to backend
    # Our own app
    'wallet',
]

MIDDLEWARE = [
    # corsheaders MUST be first in this list
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
# SQLite = a simple file based database
# Perfect for learning — no setup needed
# db.sqlite3 file gets created automatically
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Tell Django REST Framework to use JWT for login
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# JWT token settings
# Access token = short lived, used for every request
# Refresh token = long lived, used to get new access token
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
}

# Allow ALL origins to talk to our backend
# This means our phone app can send requests
CORS_ALLOW_ALL_ORIGINS = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'