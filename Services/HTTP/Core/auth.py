from fastapi import APIRouter, Form
from utils import *
import static_data
import aio_pika
import asyncio
import json
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

router = APIRouter(
    prefix="/api/auth",
    tags=["authentication"],
    responses={404: {"description": "Not found"}}
)

class AuthTestRequest(BaseModel):
    email: str = Field(..., example="user@example.com")
    password: str = Field(..., min_length=8, example="StrongPass123")

class AuthTestResponse(BaseModel):
    status: str = Field(..., example="success")
    user_id: Optional[str] = Field(None, example="12345")
    message: Optional[str] = Field(None, example="Authentication successful")
    timestamp: datetime

class ErrorResponse(BaseModel):
    error: str = Field(..., example="Timeout waiting for response")
    detail: Optional[str] = Field(None, example="Service did not respond in time")

@router.post(
    "/auth_test",
    summary="Тест аутентификации",
    description="Отправляет запрос на аутентификацию через RabbitMQ и ждет ответ",
    response_description="Результат аутентификации",
    responses={
        200: {
            "description": "Успешная аутентификация",
            "model": AuthTestResponse,
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "user_id": "12345",
                        "message": "Authentication successful",
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
)
async def auth_test(email: str = Form(), password: str = Form()):
    key = generate_key(20)
    data = {
        "key": key,
        "core_index": static_data.CORE_INDEX,
        "data": {
            "email": email,
            "password": password
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
    
    max_wait = 30
    for _ in range(max_wait):
        if key in static_data.returned_messages:
            response = static_data.returned_messages.pop(key)
            return response.get("message", {})
        await asyncio.sleep(0.1)
    
    return {"error": "Timeout waiting for response"}
