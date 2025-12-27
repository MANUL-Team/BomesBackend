import secrets
import string
import static_data
import aio_pika
from fastapi.responses import JSONResponse
import asyncio


def generate_key(size):
    characters = string.ascii_letters + string.digits + string.punctuation
    secure_random_string = "".join(secrets.choice(characters) for i in range(size))
    return secure_random_string


def get_to_queue_request(key: str, endpoint: str, data: dict):
    request_data = {
        "key": key,
        "core_index": static_data.CORE_INDEX,
        "request": endpoint,
        "data": data,
    }
    return request_data


async def send_to_queue(message: str, queue: str):
    if static_data.channel:
        await static_data.channel.default_exchange.publish(
            aio_pika.Message(
                body=message, delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            ),
            routing_key=queue,
        )


async def wait_response(key: str):
    max_wait = 3000
    for _ in range(max_wait):
        if key in static_data.returned_messages:
            response = static_data.returned_messages.pop(key)
            return JSONResponse(
                status_code=response.get("code"), content=response.get("message", {})
            )
        await asyncio.sleep(0.01)
    return JSONResponse(
        status_code=400, content={"error": "Timeout waiting for response"}
    )
