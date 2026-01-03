from service_lib import Service
from datetime import datetime
from random import randint
import static

service = Service.get_service("Auth")

confirming_users = {}

@service.register_request("/api/auth/register")
def register(request_data: dict):
    username = request_data.get("username")
    email = request_data.get("email")
    password = request_data.get("password")
    code = randint(100000, 999999)
    confirming_users[email] = {
        "email": email,
        "username": username,
        "password": password,
        "code": code
    }
    response = {
        "status": "SUCCESS",
        "message": "Code was sent to your email!",
        "timestamp": datetime.now().isoformat(),
        "code": code
    }
    return response, 200

@service.register_request("/api/auth/confirm_user")
def confirm_user(request_data: dict):
    email = request_data.get("email")
    code = request_data.get("code")
    confirming_user = confirming_users.get(email)
    if not confirming_user:
        return {
            "status": "FAIL",
            "message": "Invalid code or email!",
            "timestamp": datetime.now().isoformat(),
        }, 401
    if code == confirming_user.get("code"):
        static.database_interface.add_user(
            confirming_user.get("username"), 
            confirming_user.get("email"), 
            confirming_user.get("password")
        )
        return {
            "status": "SUCCESS",
            "message": "Successful registration!",
            "timestamp": datetime.now().isoformat(),
        }, 200
    else:
        return {
            "status": "FAIL",
            "message": "Invalid code or email!",
            "timestamp": datetime.now().isoformat(),
        }, 401

@service.register_request("/api/auth/login")
def login(request_data: dict):
    email = request_data.get("email")
    password = request_data.get("password")
    user = static.database_interface.get_user_by_email(email)
    response = {
        "status": "SUCCESS",
        "message": "Successful login",
        "timestamp": datetime.now().isoformat(),
        "user_data": user
    }
    return response, 200
