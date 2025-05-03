# Выбор базового образа с Python
FROM python:3.12-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование файлов проекта
COPY . /app

# Установка зависимостей
RUN pip install Flask
RUN pip install requests
RUN pip install gevent
RUN pip install python-dotenv

# Открытие порта для взаимодействия с приложением
EXPOSE 3000

# Запуск приложения
CMD ["python", "app.py"]