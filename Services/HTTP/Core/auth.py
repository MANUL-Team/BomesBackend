from fastapi import APIRouter, Form, Request
from utils import *
import static_data
import aio_pika
import asyncio
import json
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={404: {"description": "Not found"}}
)

class RegisterRequest(BaseModel):
    email: str = Field(..., example="user@example.com")
    password: str = Field(..., min_length=8, example="StrongPass123")

class RegisterResponse(BaseModel):
    status: str = Field(..., example="SUCCESS")
    operation_id: Optional[str] = Field(None, example="12345")
    message: Optional[str] = Field(None, example="Code was sent to the email")
    timestamp: datetime

class ErrorResponse(BaseModel):
    error: Optional[str] = Field(None, example="Timeout waiting for response")

async def process_auth_request(request: Request, **kwargs):
    endpoint_path = request.url.path
    key = generate_key(20)
    data = {
        "key": key,
        "core_index": static_data.CORE_INDEX,
        "request": endpoint_path,
        "data": {
            "email": kwargs.get("email"),
            "password": kwargs.get("password")
        }
    }
    
    if static_data.channel:
        await static_data.channel.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(data).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            ),
            routing_key='auth-1'
        )
    
    max_wait = 3000
    for _ in range(max_wait):
        if key in static_data.returned_messages:
            response = static_data.returned_messages.pop(key)
            return JSONResponse(
                status_code=response.get("code"),
                content= response.get("message", {})
            )
        await asyncio.sleep(0.01)
    return JSONResponse(
        status_code=400,
        content={"error": "Timeout waiting for response"}
    )

router.post(
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
                        "operation_id": "12345",
                        "message": "Code was sent to the email",
                        "timestamp": "2024-01-01T12:00:00Z"
                    }
                }
            }
        },
        422: {
            "description": "Пользователь с такой почтой уже существует",
            "model": RegisterResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "FAIL",
                        "operation_id": "12345",
                        "message": "Email is already used",
                        "timestamp": "2024-01-01T12:00:00Z"
                    }
                }
            }
        },
        408: {
            "description": "Таймаут ожидания ответа",
            "model": ErrorResponse,
            "content": {
                "application/json": {
                    "example": {
                        "error": "Timeout waiting for response",
                        "detail": "Service did not respond within 30 seconds"
                    }
                }
            }
        }
    }
)(process_auth_request)
