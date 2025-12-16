import logging
from datetime import datetime, timedelta

from app.config import settings
from app.database import UserRepository  # <-- Импортируем репозиторий
from app.models import User
from app.redis_client import redis_client
from app.schemas import AuthRequest, AuthResponse
from app.security import security
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def authenticate_user(self, auth_request: AuthRequest) -> AuthResponse:
        """Основной метод аутентификации"""
        try:
            # Используем репозиторий для поиска пользователя
            user = await UserRepository.get_by_username(self.db, auth_request.username)
            if not user:
                # Пробуем найти по email
                user = await UserRepository.get_by_email(self.db, auth_request.username)

            if not user:
                logger.warning(f"User not found: {auth_request.username}")
                return self._create_error_response(
                    auth_request, "Invalid username or password"
                )

            if not user.is_active:
                logger.warning(f"User inactive: {user.username}")
                return self._create_error_response(
                    auth_request, "Account is deactivated"
                )

            # Проверяем пароль
            if not security.verify_password(
                auth_request.password, user.hashed_password
            ):
                logger.warning(f"Invalid password for user: {user.username}")
                return self._create_error_response(
                    auth_request, "Invalid username or password"
                )

            # Обновляем время последнего входа через репозиторий
            await UserRepository.update_last_login(self.db, user.id)

            # Обновляем время последнего входа
            user.last_login = datetime.utcnow()
            await self.db.commit()

            # Генерируем токены
            token_data = {"sub": user.username, "user_id": user.id, "email": user.email}

            access_token = security.create_access_token(token_data)
            refresh_token = security.create_refresh_token(token_data)

            # Рассчитываем время истечения
            expires_at = datetime.utcnow() + timedelta(
                minutes=settings.access_token_expire_minutes
            )

            # Сохраняем токены в Redis
            await redis_client.save_token(
                user.id,
                {"access_token": access_token, "expires_at": expires_at.isoformat()},
            )

            await redis_client.save_token(
                user.id, {"refresh_token": refresh_token}, is_refresh=True
            )

            # Сохраняем сессию
            await redis_client.save_user_session(
                user.id,
                {
                    "username": user.username,
                    "login_time": datetime.utcnow().isoformat(),
                    "client_ip": auth_request.client_ip,
                    "user_agent": auth_request.user_agent,
                },
            )

            logger.info(f"User authenticated successfully: {user.username}")

            return AuthResponse(
                correlation_id=auth_request.correlation_id,
                request_id=auth_request.request_id,
                success=True,
                access_token=access_token,
                refresh_token=refresh_token,
                username=user.username,
                user_id=user.id,
            )

        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return self._create_error_response(
                auth_request, f"Internal server error: {str(e)}"
            )

    def _create_error_response(
        self, auth_request: AuthRequest, error_message: str
    ) -> AuthResponse:
        """Создаем ответ об ошибке"""
        return AuthResponse(
            correlation_id=auth_request.correlation_id,
            request_id=auth_request.request_id,
            success=False,
            error_message=error_message,
        )
