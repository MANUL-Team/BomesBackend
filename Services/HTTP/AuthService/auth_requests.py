from datetime import datetime


def register(username: str, email: str, password: str):
    response = {
        "status": "SUCCESS",
        "message": "Code was sent to your email!",
        "timestamp": datetime.now().isoformat(),
        "more": f"Your data: {username}, {email}, {password}"
    }
    return response, 200

def login(email: str, password: str):
    response = {
        "status": "SUCCESS",
        "message": "Successful login",
        "timestamp": datetime.now().isoformat(),
        "more": f"Your data: {email}, {password}"
    }
    return response, 200
