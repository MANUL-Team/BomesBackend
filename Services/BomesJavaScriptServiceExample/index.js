// Импорт библиотек, установка констант и стандартных настроек express
// #######################################################
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js"); // Импорт утилитных функций. См. файл Utils.js

const app = express();

const PORT = process.env.PORT;
const CORE_ADDRESS = process.env.CORE_ADDRESS;

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));
// #######################################################

// Обработка GET запроса
app.get("/get_javascript_example", (req, res) => {
    Utils.log(`GET JS Example, IP: ${req.ip.slice(7)}`);
    res.send("GET JavaScript Example");
});

// Обработка POST запроса
app.post("/post_javascript_example", (req, res) => {
    Utils.log(`POST JS Example, IP: ${req.ip.slice(7)}`);
    res.send(`POST JavaScript Example. Data: ${JSON.stringify(req.body)}`);
});

// Запуск сервера
app.listen(PORT, () => {
    Utils.log(`Сервер запущен на порту ${PORT}`);
});

// Отправка запроса на регистрацию в ядро
request.post(
    {
        url: `http://${CORE_ADDRESS}/register_service`,
        form: {
            // Вся информация в виде json-строки в поле data
            data: JSON.stringify({
                port: PORT,
                requests: [
                    {
                        type: "GET",
                        value: "/get_javascript_example"
                    },
                    {
                        type: "POST",
                        value: "/post_javascript_example"
                    }
                ]
            })
        }
    },
    (err, response, body) => {
        if (err) console.log(err);
        else {
            Utils.log("REGISTERED!");
        }
    }
);
