from aiohttp import web
import mysql.connector

database = mysql.connector.connect(user='bomes', password='bomes',
                              host='192.168.31.55',
                              database='BomesDatabase')

async def handle(request):
    name = request.match_info.get('name', "World")
    text = f"Hello, {name}!"
    return web.Response(text=text)

async def get_users(request):
    cursor = database.cursor()
    query = ("SELECT username FROM users")
    cursor.execute(query)
    result = ""
    for username in cursor:
        result += f"{username[0]}\n"
    return web.Response(text=result)

app = web.Application()
app.add_routes([
    web.get('/api/', handle),
    web.get('/api/{name}', handle),
    web.get('/api/get_users', get_users)
])

if __name__ == '__main__':
    web.run_app(app, port=3000)
