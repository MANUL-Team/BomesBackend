FROM python:3.12-slim-bookworm

COPY . /main

WORKDIR /main

RUN pip install -r requirements.txt

EXPOSE 3000

CMD ["python3", "main.py"]
