from fastapi import FastAPI
import uvicorn
import aio_pika
import json
import static_data
from contextlib import asynccontextmanager
from auth import router as auth_router
from datetime import datetime

openapi_tags = [
    {
        "name": "authentication",
        "description": "Операции аутентификации и авторизации",
    },
    {
        "name": "health",
        "description": "Проверка работоспособности сервера",
    }
]

async def core_callback(message: aio_pika.IncomingMessage):
    async with message.process():
        returned_data = json.loads(message.body.decode())
        key = returned_data.get("key")
        if key:
            static_data.returned_messages[key] = returned_data
            print(f"Received message for key: {key}")

async def setup_rabbitmq():
    static_data.connection = await aio_pika.connect_robust(
        f"amqp://{static_data.RABBIT_USERNAME}:{static_data.RABBIT_PASSWORD}@{static_data.RABBIT_ADDRESS}/"
    )
    static_data.channel = await static_data.connection.channel()
    
    await static_data.channel.declare_queue('auth-1')
    core_queue = await static_data.channel.declare_queue(f'core-{static_data.CORE_INDEX}')
    
    await core_queue.consume(core_callback)
    print("RabbitMQ was setup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await setup_rabbitmq()
    yield
    if static_data.connection:
        await static_data.connection.close()

app = FastAPI(
    title="Bomes HTTP API",
    description="HTTP API проекта Bomes",
    version="1.0.0",
    openapi_tags=openapi_tags,
    contact={
        "name": "Support Team",
        "email": "mainadmin@bomes.ru",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    lifespan=lifespan,
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,
        "defaultModelExpandDepth": 1,
        "docExpansion": "none",
        "filter": True,
        "showExtensions": True,
        "showCommonExtensions": True,
        "persistAuthorization": True,
        "displayRequestDuration": True,
        "tryItOutEnabled": True,
    }
)
app.include_router(auth_router)

@app.get(
    "/health",
    tags=["health"],
    summary="Проверка работоспособности",
    description="Проверяет, что сервер запущен и работает",
    response_description="Статус сервера",
    responses={
        200: {
            "description": "Сервер работает нормально",
            "content": {
                "application/json": {
                    "example": {"status": "healthy", "timestamp": "2024-01-01T12:00:00Z"}
                }
            }
        }
    })
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
