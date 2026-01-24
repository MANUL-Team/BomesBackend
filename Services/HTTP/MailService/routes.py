from service_lib import Service
from datetime import datetime
from random import randint
import static

service = Service.get_service("Mail")

confirming_users = {}

@service.register_request("/api/mail/send_mail")
def send_mail(request_data: dict):
    email = request_data.get("email")
    data = request_data.get("data")
    response = {
        "status": "SUCCESS",
        "message": "Mail was sent",
        "timestamp": datetime.now().isoformat()
    }
    return response, 200
