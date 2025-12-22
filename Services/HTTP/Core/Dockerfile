FROM python:3.12-alpine AS builder

RUN apk add --no-cache \
    build-base \
    python3-dev \
    linux-headers \
    git \
    cmake \
    gfortran \
    musl-dev \
    openblas-dev

WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip wheel --wheel-dir /wheels --no-cache-dir -r requirements.txt

FROM python:3.12-alpine

RUN apk add --no-cache \
    curl \
    busybox-extras \
    bind-tools

WORKDIR /app

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-index --find-links=/wheels --no-cache-dir -r requirements.txt && \
    rm -rf /wheels

COPY . /app

CMD ["python3", "main.py"]