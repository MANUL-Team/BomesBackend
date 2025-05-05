// Импорт библиотек, установка констант и стандартных настроек express
// #################################
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js"); // Импорт утилитных функций. См. файл Utils.js

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));
// #################################

// Запрос для проверки работоспособности
app.get('/', (req, res) => {
    Utils.log(`IP: ${req.ip.slice(7)}`);
    res.sendStatus(200);
});

// Запрос регистрации нового сервиса
app.post("/register_service", (req, res) => {
    if (!req.body) return res.sendStatus(400);
    // Вся информация находится в json-строке в поле data
    req.body = JSON.parse(req.body.data);
    const server_ip = req.ip.slice(7);
    const server_port = req.body.port;
    const server_requests = req.body.requests;
    // Добавляем обработку (перенаправление) запросов сервиса
    for (let i = 0; i < server_requests.length; i++) {
        // Для GET запросов простое перенаправление
        if (server_requests[i].type === "GET"){
            app.get(server_requests[i].value, (r, rs) => {
                request(`http://${server_ip}:${server_port}${server_requests[i].value}`,
                    (err, response, body) => {
                        if (err) return rs.status(400).send({error: err});
                        return rs.send(body);
                    }
                );
            });
        }
        // Для POST запросов перенаправление с body
        else if (server_requests[i].type === "POST") {
            app.post(server_requests[i].value, (r, rs) => {
                request.post(
                    {
                        url: `http://${server_ip}:${server_port}${server_requests[i].value}`,
                        // body перенаправляется форматированно: json с полем data, значение которого - json-строка
                        form: {
                            data: JSON.stringify(r.body)
                        }
                    },
                    (err, response, body) => {
                        if (err) return rs.status(400).send({error: err});
                        return rs.send(body);
                    }
                );
            });
        }
    }
    request.post(
        {
            url: `http://dev.bomes.ru/api/register_notification`,
            form: {
                data: req
            }
        },
        (err, response, body) => {
            if (err) return rs.status(400).send({error: err});
            return rs.send(body);
        }
    );
    Utils.log(`Registered new service! Requests: ${JSON.stringify(server_requests)}`);
    res.sendStatus(200);
});

// Запуск сервера
app.listen(PORT, () => {
    Utils.log(`Сервер запущен на порту ${PORT}`);
});
