from aiohttp import web
import mysql.connector
import random
import string
import time

database = mysql.connector.connect(user='bomes', password='bomes',
                              host='192.168.31.55',
                              database='BomesDatabase')

tokens = {}
token_timeout = 10

def generate_random_string(length):
    result = [random.choice(string.ascii_lowercase + string.digits if i != 5 else string.ascii_uppercase) for i in range(length)]
    return ''.join(result)

def check_token(token):
    if token in tokens:
        if tokens[token]["last_use"] < time.time() - token_timeout:
            tokens.pop(token)
            return None
        tokens[token]["last_use"] = time.time()
        return tokens[token].get("email")
    return None

async def get_token(request):
    email_header = request.headers.get('Email')
    pass_header = request.headers.get('Pass')
    cursor = database.cursor()
    query = ("SELECT 1 FROM users WHERE email = %s AND password = %s")
    cursor.execute(query, (email_header, pass_header))
    result = False
    for _ in cursor:
        result = True
    if result:
        token = generate_random_string(50)
        tokens[token] = {"email": email_header, "last_use": time.time()}
        return web.Response(text=token)
    else:
        return web.Response(text=f"Data is incorrect!")

async def anything(request):
    auth_header = request.headers.get('Authorization')
    token = auth_header.split()[-1]
    email = check_token(token)
    if email:
        return web.Response(text=f"Hello, {email}")
    else:
        return web.Response(text=f"Please, check your token. It is an incorrect!")

app = web.Application()
app.add_routes([
    web.get('/api/v1/get_token', get_token),
    web.get('/api/v1/anything', anything)
])

if __name__ == '__main__':
    web.run_app(app, port=3000)
