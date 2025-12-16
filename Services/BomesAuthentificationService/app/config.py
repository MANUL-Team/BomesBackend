from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq-dev.bomes.ru:31672/"
    auth_queue: str = "authentication-queue"
    httpcore_queue_prefix: str = "httpcore-"

    # JWT
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Database
    database_url: str = "postgresql+asyncpg://bomes:bomes@localhost:5432/BomesDatabase"

    # Redis
    redis_url: str = "redis://localhost:6379"
    redis_token_prefix: str = "token:"
    redis_user_prefix: str = "user:"

    class Config:
        env_file = ".env"


settings = Settings()
