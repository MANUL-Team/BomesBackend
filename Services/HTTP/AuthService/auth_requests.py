from datetime import datetime


def register(username: str, email: str, password: str):
    message = {
        "status": "SUCCESS",
        "message": "Code was sent to your email!",
        "timestamp": datetime.now().isoformat(),
        "more": f"Your data: {username}, {email}, {password}"
    }
    response = {
        "message": message
    }
    return response, 200

def login(email: str, password: str):
    message = {
        "status": "SUCCESS",
        "message": "Successful login",
        "timestamp": datetime.now().isoformat(),
        "more": f"Your data: {email}, {password}"
    }
    response = {
        "message": message
    }
    return response, 200
