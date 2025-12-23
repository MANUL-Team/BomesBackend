import aio_pika
import json
import os
from dotenv import load_dotenv
from auth_requests import *

load_dotenv()

RABBIT_ADDRESS = os.getenv("RABBIT_ADDRESS")
RABBIT_USERNAME = os.getenv("RABBIT_USERNAME", "guest")
RABBIT_PASSWORD = os.getenv("RABBIT_PASSWORD", "guest")

def main():
    connection = await aio_pika.connect_robust(
        f"amqp://{RABBIT_USERNAME}:{RABBIT_PASSWORD}@{RABBIT_ADDRESS}/"
    )
    channel = await connection.channel()
    async def auth_callback(message: aio_pika.IncomingMessage):
        async with message.process():
            print(f" [x] Received {message.body.decode()}")
            data = json.loads(message.body.decode())
            request = data.get("request")
            core_index = data.get("core_index")
            response_message = f"Unknown request: {request}"
            request_data = data.get("data", {})
            code = 404
            if request == "/api/auth/register":
                response_message, code = register(request_data.get("email"), request_data.get("password"))
            response = {
                "key": data.get("key"),
                "message": response_message,
                "code": code
            }
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(response, ensure_ascii=False).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                ),
                routing_key=f'core-{core_index}',
            )
    auth_queue = await static_data.channel.declare_queue(f'auth-1')
    await auth_queue.consume(auth_callback)

    print(' [*] Waiting for messages. To exit press CTRL+C')
    channel.start_consuming()

if __name__ == '__main__':
    main()
