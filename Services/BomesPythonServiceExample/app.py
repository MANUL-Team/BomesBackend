from flask import Flask, request
import requests
from gevent.pywsgi import WSGIServer
import json
import os
from dotenv import load_dotenv

config = dotenv_values()

app = Flask(__name__)
PORT = config["PORT"]
CORE_ADDRESS = config["CORE_ADDRESS"]

@app.route("/get_python_example", methods=['GET'])
def get_python_example():
    return "PythonExample"

@app.route("/post_python_example", methods=['POST'])
def post_python_example():
    return request.form

def register_service():
    data = {
        "data": json.dumps({
            "port": PORT,
            "requests": [
                {
                    "type": "GET",
                    "value": "/get_python_example"
                },
                {
                    "type": "POST",
                    "value": "/post_python_example"
                }
            ]
        })
    }
    response = requests.post(f"http://{CORE_ADDRESS}/register_service", data=data)
 
if __name__ == "__main__":
    register_service()
    http_server = WSGIServer(('', PORT), app)
    http_server.serve_forever()
    