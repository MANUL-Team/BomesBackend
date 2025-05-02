from flask import Flask
import requests
from gevent.pywsgi import WSGIServer
 
app = Flask(__name__)
PORT = 3000
CORE_ADDRESS = ""
 
@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/python_example")
def python_example():
    return "PythonExample"

def register_service():
    print("Registrating service...")
    data = {
        "port": PORT,
        "requests": [
            {
                "type": "GET",
                "value": "/python_example"
            }
        ]
    }
    response = requests.post("http://172.20.1.140:3000/register_service", data=data)
 
if __name__ == "__main__":
    from waitress import serve
    http_server = WSGIServer(('', PORT), app)
    http_server.serve_forever()
    register_service()
