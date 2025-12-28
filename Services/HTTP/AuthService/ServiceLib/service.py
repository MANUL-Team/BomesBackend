import functools
import os
from dotenv import load_dotenv
import aio_pika
import json
import asyncio

load_dotenv()
RABBIT_ADDRESS = os.getenv("RABBIT_ADDRESS")
RABBIT_USERNAME = os.getenv("RABBIT_USERNAME", "guest")
RABBIT_PASSWORD = os.getenv("RABBIT_PASSWORD", "guest")

class Service:

    Instances = {}

    def __init__(self, service_name):
        self.service_name = service_name
        self.requests = {}
        Service.Instances[service_name] = self
    
    def get_service(service_name):
        if not Service.Instances.get(service_name):
            Service(service_name)
        return Service.Instances.get(service_name)
    
    def register_request(self, request_path):
        def decorator(func):
            self.requests[request_path] = func

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            return wrapper
        return decorator

    def run(self):
        async def main():
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

                    response_func = self.requests.get(request)
                    if response_func:
                        response_message, code = response_func(request_data)

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
            auth_queue = await channel.declare_queue(f'auth-1')
            await auth_queue.consume(auth_callback)

            print(' [*] Waiting for messages. To exit press CTRL+C')
            await asyncio.Future()

        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            print("\n [*] Auth service stopped")
