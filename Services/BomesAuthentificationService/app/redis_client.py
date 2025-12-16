import json
from typing import Optional

import redis.asyncio as redis
from app.config import settings


class RedisClient:
    def __init__(self):
        self.redis = None

    async def connect(self):
        self.redis = redis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )

    async def close(self):
        if self.redis:
            await self.redis.close()

    async def save_token(
        self, user_id: int, token_data: dict, is_refresh: bool = False
    ):
        """Сохраняем токен в Redis"""
        key = f"{settings.redis_token_prefix}{user_id}:{'refresh' if is_refresh else 'access'}"

        # Сохраняем на время жизни токена
        expire_seconds = (
            settings.refresh_token_expire_days * 24 * 60 * 60
            if is_refresh
            else settings.access_token_expire_minutes * 60
        )

        await self.redis.setex(key, expire_seconds, json.dumps(token_data))

    async def get_token(
        self, user_id: int, token_type: str = "access"
    ) -> Optional[dict]:
        """Получаем токен из Redis"""
        key = f"{settings.redis_token_prefix}{user_id}:{token_type}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None

    async def delete_token(self, user_id: int, token_type: str = "access"):
        """Удаляем токен из Redis"""
        key = f"{settings.redis_token_prefix}{user_id}:{token_type}"
        await self.redis.delete(key)

    async def save_user_session(self, user_id: int, session_data: dict):
        """Сохраняем сессию пользователя"""
        key = f"{settings.redis_user_prefix}{user_id}:session"
        await self.redis.setex(
            key,
            3600,  # 1 час
            json.dumps(session_data),
        )

    async def block_token(self, token: str, expires_in: int):
        """Добавляем токен в черный список (для logout)"""
        key = f"blacklist:{token}"
        await self.redis.setex(key, expires_in, "1")


redis_client = RedisClient()
