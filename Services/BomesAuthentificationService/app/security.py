import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import jwt  # pyjwt вместо python-jose
from app.config import settings
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

# Настройка CryptContext с поддержкой большего количества форматов
pwd_context = CryptContext(
    schemes=[
        "sha256_crypt",  # $5$
    ],
    deprecated="auto",
    default="sha256_crypt",
)


class Security:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Проверяем пароль с диагностикой"""
        try:
            logger.debug(
                f"Attempting to verify password. Hash format: {hashed_password[:30]}..."
            )

            # Пробуем стандартную проверку
            result = pwd_context.verify(plain_password, hashed_password)

            if result:
                logger.debug("Password verification successful")
            else:
                logger.debug("Password verification failed")

            return result

        except Exception as e:
            logger.error(f"Password verification error: {e}")
            logger.error(f"Hash value that caused error: {hashed_password}")

            # Пробуем альтернативные методы
            return Security._try_alternative_verification(
                plain_password, hashed_password
            )

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Генерируем новый хеш пароля"""
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(
        data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """Создаем access token с использованием pyjwt"""
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.access_token_expire_minutes
            )

        to_encode.update(
            {
                "exp": expire,
                "iat": datetime.utcnow(),
                "type": "access",
                "token_type": "access",
            }
        )

        # Используем pyjwt
        encoded_jwt = jwt.encode(
            to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        return encoded_jwt

    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> str:
        """Создаем refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)

        to_encode.update(
            {
                "exp": expire,
                "iat": datetime.utcnow(),
                "type": "refresh",
                "token_type": "refresh",
            }
        )

        encoded_jwt = jwt.encode(
            to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        return encoded_jwt

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Проверяем и декодируем токен"""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
                options={"verify_exp": True},
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return None

    @staticmethod
    def get_token_payload(token: str) -> Optional[Dict[str, Any]]:
        """Получаем payload из токена без проверки expiration"""
        try:
            # Декодируем без проверки expiration
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
                options={"verify_exp": False},
            )
            return payload
        except Exception as e:
            logger.error(f"Failed to decode token: {e}")
            return None

    @staticmethod
    def create_tokens_pair(user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Создаем пару access и refresh токенов"""
        access_token = Security.create_access_token(user_data)
        refresh_token = Security.create_refresh_token(user_data)

        # Вычисляем время истечения
        expires_at = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_at": expires_at,
            "expires_in": settings.access_token_expire_minutes * 60,  # в секундах
            "user_data": user_data,
        }


security = Security()
