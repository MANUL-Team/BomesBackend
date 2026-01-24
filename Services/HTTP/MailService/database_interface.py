import os
from psycopg2 import sql, connect, errors
from psycopg2.extras import RealDictCursor
from datetime import date
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class DatabaseInterface:
    def __init__(self):
        self.db_config = {
            'dbname': os.getenv('DB_NAME'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'host': os.getenv('DB_HOST'),
            'port': os.getenv('DB_PORT'),
        }

        self.db_config = {k: v for k, v in self.db_config.items() if v is not None}

        required = ['dbname', 'user', 'password', 'host', 'port']
        missing = [k for k in required if k not in self.db_config]
        if missing:
            raise ValueError(f"���  ���������� � .env: {missing}")


    def _execute_with_connection(self, query, params=None, fetch=False, fetchone=False):
        with connect(**self.db_config) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                if fetch:
                    if fetchone:
                        return cur.fetchone()
                    return cur.fetchall()
                conn.commit()
                return None

    def add_user(
        self,
        username: str,
        email: str,
        password_hash: str,
        birth_date: Optional[date] = None,
        gender: Optional[str] = None,
        avatar_url: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Optional[int]:
        query = sql.SQL("""
            INSERT INTO users (username, email, password_hash, birth_date, gender, avatar_url, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """)
        try:
            result = self._execute_with_connection(
                query,
                (username, email, password_hash, birth_date, gender, avatar_url, status),
                fetch=True,
                fetchone=True
            )
            return result['id'] if result else None
        except errors.UniqueViolation as e:
            msg = str(e)
            if 'users_username_key' in msg:
                print(f"������: ������������ � username '{username}' ��� ����������.")
            elif 'users_email_key' in msg:
                print(f"������: ������������ � email '{email}' ��� ����������.")
            else:
                print(f"������ ������������: {msg}")
            return None
        except Exception as e:
            print(f"������ ������: {e}")
            return None

    def delete_user(self, user_id: int) -> bool:
        with connect(**self.db_config) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
                return cur.rowcount > 0

    def get_user_by_id(self, user_id: int) -> Optional[dict]:
        result = self._execute_with_connection(
            "SELECT * FROM users WHERE id = %s",
            (user_id,),
            fetch=True,
            fetchone=True
        )
        return dict(result) if result else None

    def get_user_by_email(self, email: str) -> Optional[dict]:
        result = self._execute_with_connection(
            "SELECT * FROM users WHERE email = %s",
            (email,),
            fetch=True,
            fetchone=True
        )
        return dict(result) if result else None

