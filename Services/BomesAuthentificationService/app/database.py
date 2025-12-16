import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from app.config import settings
from app.models import Base
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)


class Database:
    def __init__(self):
        self.engine = None
        self.async_session_maker = None
        self.is_connected = False

    async def connect(self):
        """Подключаемся к базе данных"""
        try:
            # Создаем асинхронный engine
            self.engine = create_async_engine(
                settings.database_url,
                echo=True,  # Включаем логирование SQL запросов (можно отключить в продакшене)
                future=True,
                pool_size=20,
                max_overflow=10,
                pool_pre_ping=True,  # Проверяем соединение перед использованием
                pool_recycle=3600,  # Пересоздаем соединения каждый час
            )

            # Создаем фабрику сессий
            self.async_session_maker = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
            )

            # Создаем таблицы если их нет
            await self.create_tables()

            self.is_connected = True
            logger.info("Database connected successfully")

        except Exception as e:
            logger.error(f"Database connection error: {str(e)}")
            raise

    async def create_tables(self):
        """Создаем таблицы в базе данных"""
        try:
            async with self.engine.begin() as conn:
                # Создаем все таблицы из Base.metadata
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created/verified")
        except Exception as e:
            logger.error(f"Error creating tables: {str(e)}")
            raise

    async def disconnect(self):
        """Закрываем соединение с базой данных"""
        if self.engine:
            await self.engine.dispose()
            self.is_connected = False
            logger.info("Database disconnected")

    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Контекстный менеджер для сессий БД"""
        if not self.is_connected:
            await self.connect()

        session = self.async_session_maker()
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()

    async def get_session(self) -> AsyncSession:
        """Получаем сессию БД (альтернативный метод)"""
        if not self.is_connected:
            await self.connect()
        return self.async_session_maker()

    async def execute_query(self, query):
        """Выполняем SQL запрос напрямую"""
        async with self.session() as session:
            result = await session.execute(query)
            return result

    async def health_check(self) -> bool:
        """Проверка доступности базы данных"""
        try:
            async with self.session() as session:
                # Простой запрос для проверки соединения
                result = await session.execute("SELECT 1")
                return result.scalar() == 1
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return False


# Создаем глобальный экземпляр базы данных
database = Database()


# Утилитарные функции для работы с БД
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency для FastAPI эндпоинтов
    Использование:
        @app.post("/users/")
        async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
            ...
    """
    async with database.session() as session:
        yield session


async def init_db():
    """Инициализация базы данных (создание начальных данных)"""
    from app.security import security

    async with database.session() as session:
        from app.models import User
        from sqlalchemy import select

        # Проверяем, есть ли уже пользователи
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()

        if not user:
            # Создаем тестового пользователя (для разработки)
            test_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=security.get_password_hash("admin123"),
                display_name="Administrator",
                is_active=True,
            )
            session.add(test_user)
            await session.commit()
            logger.info("Test user created: admin / admin123")

        # Можно добавить другие начальные данные здесь


# Модель для работы с конкретными таблицами
class UserRepository:
    """Репозиторий для работы с пользователями"""

    @staticmethod
    async def get_by_username(session: AsyncSession, username: str):
        """Получить пользователя по username"""
        from app.models import User
        from sqlalchemy import select

        result = await session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str):
        """Получить пользователя по email"""
        from app.models import User
        from sqlalchemy import select

        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: int):
        """Получить пользователя по ID"""
        from app.models import User
        from sqlalchemy import select

        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_user(session: AsyncSession, user_data: dict):
        """Создать нового пользователя"""
        from app.models import User

        user = User(**user_data)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    @staticmethod
    async def update_last_login(session: AsyncSession, user_id: int):
        """Обновить время последнего входа"""
        from datetime import datetime

        from app.models import User
        from sqlalchemy import update

        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(last_login=datetime.utcnow(), last_seen=datetime.utcnow())
        )
        await session.execute(stmt)
        await session.commit()

    @staticmethod
    async def set_online_status(session: AsyncSession, user_id: int, is_online: bool):
        """Установить онлайн статус пользователя"""
        from datetime import datetime

        from app.models import User
        from sqlalchemy import update

        values = {"is_online": is_online}
        if not is_online:
            values["last_seen"] = datetime.utcnow()

        stmt = update(User).where(User.id == user_id).values(**values)
        await session.execute(stmt)
        await session.commit()

    @staticmethod
    async def search_users(session: AsyncSession, search_term: str, limit: int = 50):
        """Поиск пользователей по username или display_name"""
        from app.models import User
        from sqlalchemy import or_, select

        search_pattern = f"%{search_term}%"
        stmt = (
            select(User)
            .where(
                or_(
                    User.username.ilike(search_pattern),
                    User.display_name.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                ),
                User.is_active == True,
            )
            .limit(limit)
        )

        result = await session.execute(stmt)
        return result.scalars().all()
