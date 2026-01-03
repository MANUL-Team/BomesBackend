from fastapi import APIRouter, Form, Request
from utils import *
import json
from auth.auth_models import *

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={404: {"description": "Not found"}},
)


async def process_auth_request(endpoint_path: str, **kwargs):
    key = generate_key(20)
    request_data = get_to_queue_request(key=key, endpoint=endpoint_path, data=kwargs)

    await send_to_queue(message=json.dumps(request_data).encode(), queue="auth-1")

    response = await wait_response(key)
    return response


@router.post(
    "/register",
    summary="Запрос на регистрацию",
    description="Отправляет запрос на регистрацию",
    response_description="Результат регистрации",
    responses={
        200: {
            "description": "Успешная регистрация",
            "model": RegisterResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "SUCCESS",
                        "message": "Code was sent to the email",
                        "timestamp": "2024-01-01T12:00:00Z",
                    }
                }
            },
        },
        422: {
            "description": "Пользователь с такой почтой уже существует",
            "model": RegisterResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "FAIL",
                        "message": "Email is already used",
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
async def register(
    request: Request,
    username: str = Form(),
    email: str = Form(),
    password: str = Form(),
):
    endpoint_path = request.url.path
    return await process_auth_request(
        endpoint_path, username=username, email=email, password=password
    )


@router.post(
    "/login",
    summary="Запрос на вход",
    description="Отправляет запрос на вход",
    response_description="Результат входа",
    responses={
        200: {
            "description": "Успешный вход",
            "model": LoginResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "SUCCESS",
                        "message": "Successful login",
                        "timestamp": "2024-01-01T12:00:00Z",
                    }
                }
            },
        },
        401: {
            "description": "Неверная почта или пароль",
            "model": LoginResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "FAIL",
                        "message": "Invalid email or password",
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
async def login(
    request: Request,
    email: str = Form(),
    password: str = Form(),
):
    endpoint_path = request.url.path
    return await process_auth_request(
        endpoint_path, email=email, password=password
    )

@router.post(
    "/confirm_user",
    summary="Запрос на подтверждение почты",
    description="Подтверждает почту",
    response_description="Результат подтверждения почты",
    responses={
        200: {
            "description": "Успешное подтверждение",
            "model": ConfirmUserResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "SUCCESS",
                        "message": "Successful registration!",
                        "timestamp": "2024-01-01T12:00:00Z",
                    }
                }
            },
        },
        401: {
            "description": "Неверная почта или код",
            "model": ConfirmUserResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "FAIL",
                        "message": "Invalid code or email!",
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
async def confirm_user(
    request: Request,
    email: str = Form(),
    code: int = Form(),
):
    endpoint_path = request.url.path
    return await process_auth_request(
        endpoint_path, email=email, code=code
    )
