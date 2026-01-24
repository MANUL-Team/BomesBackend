from fastapi import APIRouter, Form, Request
from utils import *
import json
from mail.mail_models import *

router = APIRouter(
    prefix="/mail",
    tags=["mail"],
    responses={404: {"description": "Not found"}},
)


async def process_mail_request(endpoint_path: str, **kwargs):
    key = generate_key(20)
    request_data = get_to_queue_request(key=key, endpoint=endpoint_path, data=kwargs)

    await send_to_queue(message=json.dumps(request_data).encode(), queue="Mail")

    response = await wait_response(key)
    return response


@router.post(
    "/send_mail",
    summary="Письмо от лица Bomes",
    description="Отправляет письмо от лица Bomes",
    response_description="Результат отправки письма",
    responses={
        200: {
            "description": "Успешная отправка письма",
            "model": SendMailResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "SUCCESS",
                        "message": "Mail was sent",
                        "timestamp": "2024-01-01T12:00:00Z",
                    }
                }
            },
        },
        408: {
            "description": "Таймаут ожидания ответа",
            "model": ErrorResponse,
            "content": {
                "application/json": {
                    "example": {
                        "error": "Timeout waiting for response",
                        "detail": "Service did not respond within 30 seconds",
                    }
                }
            },
        },
    },
)
async def send_mail(
    request: Request,
    email: str = Form(),
    data: str = Form(),
):
    endpoint_path = request.url.path
    return await process_auth_request(
        endpoint_path, email=email, data=data
    )
