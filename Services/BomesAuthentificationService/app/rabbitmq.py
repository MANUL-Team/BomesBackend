import json
from typing import Optional

import aio_pika
from aio_pika.abc import AbstractRobustConnection
from app.config import settings


class RabbitMQClient:
    def __init__(self):
        self.connection: Optional[AbstractRobustConnection] = None
        self.channel = None
        self.auth_queue = None
        self.httpcore_queue = None

    async def connect(self):
        """Подключаемся к RabbitMQ"""
        self.connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        self.channel = await self.connection.channel()

        # Объявляем очередь для входящих запросов
        self.auth_queue = await self.channel.declare_queue(
            settings.auth_queue, durable=True
        )

        print(f"Connected to RabbitMQ, listening on queue: {settings.auth_queue}")

    async def close(self):
        """Закрываем соединение"""
        if self.connection:
            await self.connection.close()

    async def consume_auth_requests(self, callback):
        """Начинаем слушать очередь аутентификации"""
        await self.auth_queue.consume(callback)

    async def publish_to_httpcore(self, response_data: dict, success: bool):
        """Публикуем результат в HTTPCore очередь"""
        queue_name = (
            f"{settings.httpcore_queue_prefix}{'success' if success else 'error'}"
        )

        # Создаем очередь для HTTPCore если не существует
        queue = await self.channel.declare_queue(queue_name, durable=True)

        # Отправляем сообщение
        await self.channel.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(response_data).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=queue_name,
        )

        print(f"Published to {queue_name}: {response_data['success']}")


rabbitmq_client = RabbitMQClient()
