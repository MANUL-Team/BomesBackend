import asyncio
import json
import logging
from contextlib import asynccontextmanager

from app.database import database
from app.rabbitmq import rabbitmq_client
from app.redis_client import redis_client
from app.schemas import AuthRequest
from app.services.auth_service import AuthService
from fastapi import FastAPI

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    logger.info("Starting Authentication Service...")

    # Подключаемся к БД
    await database.connect()
    logger.info("Database connected")

    # Подключаемся к Redis
    await redis_client.connect()
    logger.info("Redis connected")

    # Подключаемся к RabbitMQ
    await rabbitmq_client.connect()
    logger.info("RabbitMQ connected")

    # Запускаем consumer
    asyncio.create_task(start_rabbitmq_consumer())

    yield

    # Shutdown
    await redis_client.close()
    await rabbitmq_client.close()
    await database.disconnect()
    logger.info("Authentication Service stopped")


app = FastAPI(title="Authentication Service", lifespan=lifespan)


async def process_auth_message(message):
    """Обработка сообщения из RabbitMQ"""
    async with message.process():
        try:
            # Парсим сообщение
            body = json.loads(message.body.decode())
            auth_request = AuthRequest(**body)

            logger.info(f"Processing auth request for user: {auth_request.username}")

            # Получаем сессию БД
            async with database.session() as session:
                # Аутентифицируем пользователя
                auth_service = AuthService(session)
                response = await auth_service.authenticate_user(auth_request)

                # Отправляем результат в HTTPCore очередь
                await rabbitmq_client.publish_to_httpcore(
                    response.dict(), response.success
                )

                logger.info(
                    f"Auth processed: {auth_request.username} - Success: {response.success}"
                )

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

            # Отправляем ошибку в HTTPCore
            error_response = {
                "correlation_id": body.get("correlation_id", "unknown"),
                "request_id": body.get("request_id", "unknown"),
                "success": False,
                "error_message": f"Processing error: {str(e)}",
            }
            await rabbitmq_client.publish_to_httpcore(error_response, False)


async def start_rabbitmq_consumer():
    """Запускаем потребитель RabbitMQ"""
    await rabbitmq_client.consume_auth_requests(process_auth_message)


# HTTP эндпоинты для мониторинга и управления
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "authentication"}


@app.get("/metrics")
async def get_metrics():
    # Здесь можно добавать метрики Prometheus
    return {"connections": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
