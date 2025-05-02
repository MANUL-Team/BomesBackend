from flask import Flask
import requests
 
app = Flask(__name__)
PORT = 3000
CORE_ADDRESS = "172.20.1.140:3000"
 
@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/python_example")
def python_example():
    return "PythonExample"

def register_service():
    data = {
        "port": PORT,
        "requests": [
            {
                "type": "GET",
                "value": "/python_example"
            }
        ]
    }
    response = requests.post(f"http://{CORE_ADDRESS}/register_service", data=data)
 
if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=PORT)
    register_service()
