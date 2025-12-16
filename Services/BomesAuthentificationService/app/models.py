from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Дополнительные поля для мессенджера
    display_name = Column(String(100))
    avatar_url = Column(String(255))
    phone_number = Column(String(20), unique=True, nullable=True)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
