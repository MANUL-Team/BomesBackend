from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ErrorResponse(BaseModel):
    error: Optional[str] = Field(None, example="Timeout waiting for response")


# ----- Send mail -----
class SendMailRequest(BaseModel):
    email: str = Field(..., example="user@example.com")
    data: str = Field(..., example='{"text": "This is a test mail"}')


class SendMailResponse(BaseModel):
    status: str = Field(..., example="SUCCESS")
    message: Optional[str] = Field(None, example="Mail was sent")
    timestamp: datetime
