from ServiceLib.service import Service
from datetime import datetime

service = Service.get_service("Auth")

@service.register_request("/api/auth/register")
def register(request_data: dict):
    username = request_data.get("username")
    email = request_data.get("username")
    password = request_data.get("password")
    response = {
        "status": "SUCCESS",
        "message": "Code was sent to your email!",
        "timestamp": datetime.now().isoformat(),
        "more": f"Your data: {username}, {email}, {password}"
    }
    return response, 200

@service.register_request("/api/auth/login")
def login(request_data: dict):
    email = request_data.get("username")
    password = request_data.get("password")
    response = {
        "status": "SUCCESS",
        "message": "Successful login",
        "timestamp": datetime.now().isoformat(),
        "more": f"Your data: {email}, {password}"
    }
    return response, 200
