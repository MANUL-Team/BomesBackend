from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ErrorResponse(BaseModel):
    error: Optional[str] = Field(None, example="Timeout waiting for response")


# ----- Register -----
class RegisterRequest(BaseModel):
    username: str = Field(..., example="username")
    email: str = Field(..., example="user@example.com")
    password: str = Field(..., example="StrongPass123")


class RegisterResponse(BaseModel):
    status: str = Field(..., example="SUCCESS")
    message: Optional[str] = Field(None, example="Code was sent to the email")
    timestamp: datetime


# --------------------


# ------- Login ------
class LoginRequest(BaseModel):
    email: str = Field(..., example="user@example.com")
    password: str = Field(..., example="StrongPass123")


class LoginResponse(BaseModel):
    status: str = Field(..., example="SUCCESS")
    message: Optional[str] = Field(None, example="Successful login")
    timestamp: datetime


# --------------------
