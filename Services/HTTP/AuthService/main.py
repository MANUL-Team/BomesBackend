import pika
import json
import os
from dotenv import load_dotenv
from auth_requests import *

load_dotenv()

RABBIT_ADDRESS, RABBIT_PORT = map(str, os.getenv("RABBIT_ADDRESS").split(":"))
RABBIT_USERNAME = os.getenv("RABBIT_USERNAME", "guest")
RABBIT_PASSWORD = os.getenv("RABBIT_PASSWORD", "guest")

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters(
        host=RABBIT_ADDRESS,
        port=RABBIT_PORT
    ))
    channel = connection.channel()

    channel.queue_declare(queue='auth-1')

    def callback(ch, method, properties, body):
        print(f" [x] Received {body.decode()}")
        data = json.loads(body.decode())
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
        channel.basic_publish(exchange='',
                      routing_key=f'core-{core_index}',
                      body=json.dumps(response, ensure_ascii=False))

    channel.basic_consume(queue='auth-1',
                          on_message_callback=callback,
                          auto_ack=True)

    print(' [*] Waiting for messages. To exit press CTRL+C')
    channel.start_consuming()

if __name__ == '__main__':
    main()
