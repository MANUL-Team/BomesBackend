def register(email: str, password: str):
    response = {
        "message": f"I have got this data: {email}, {password}"
    }
    return response, 200
