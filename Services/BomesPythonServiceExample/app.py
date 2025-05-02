from flask import Flask, request
import requests
from gevent.pywsgi import WSGIServer
import json
 
app = Flask(__name__)
PORT = 3000
CORE_ADDRESS = ""

@app.route("/get_python_example", methods=['GET'])
def get_python_example():
    return "PythonExample"

@app.route("/post_python_example", methods=['POST'])
def post_python_example():
    return request.form

def register_service():
    print("Registrating service...")
    data = {
        "data": json.dumps({
            "port": PORT,
            "requests": [
                {
                    "type": "GET",
                    "value": "/python_example"
                }
            ]
        })
    }
    response = requests.post("http://172.20.1.140:3000/register_service", data=data)
 
if __name__ == "__main__":
    register_service()
    http_server = WSGIServer(('', PORT), app)
    http_server.serve_forever()
    