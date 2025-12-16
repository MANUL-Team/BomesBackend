from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# Входящие сообщения из RabbitMQ
class AuthRequest(BaseModel):
    correlation_id: str
    request_id: str
    username: str
    password: str
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None


class AuthResponse(BaseModel):
    correlation_id: str
    request_id: str
    success: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    username: Optional[str] = None
    user_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    error_message: Optional[str] = None


# Для HTTP API (если понадобится)
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    username: str
    user_id: int


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
