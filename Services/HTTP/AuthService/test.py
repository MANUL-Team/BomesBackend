
from database_interface import DatabaseInterface
from datetime import date

# Создаём экземпляр — ничего не подключается сразу
db = DatabaseInterface()

#добавляем
user_id = db.add_user(
    username="1я",
    email="я",
    password_hash="я",
    birth_date=date(2006, 6, 23),
    gender="male",
    avatar_url="11124",
    status="active"
)


#удаляем
deleted = db.delete_user(21)