import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

# Set a real unpredictable JWT_SECRET in public deployments.
JWT_SECRET = os.getenv('JWT_SECRET', 'LOCAL_DEVELOPMENT_ONLY_CHANGE_BEFORE_DEPLOY')
JWT_ALGORITHM = 'HS256'
TOKEN_HOURS = int(os.getenv('TOKEN_HOURS', '168'))
http_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    rounds = 260000
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, rounds)
    return f'pbkdf2_sha256${rounds}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}'

def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split('$')
        if scheme != 'pbkdf2_sha256':
            return False
        candidate = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(candidate, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False

def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub': str(user_id), 'iat': now, 'exp': now + timedelta(hours=TOKEN_HOURS)}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail='Требуется авторизация')
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload['sub'])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail='Недействительный токен')
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail='Пользователь не найден')
    return user
