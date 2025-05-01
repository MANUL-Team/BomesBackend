// Импорт библиотек, установка констант и стандартных настроек express
// #################################
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
// #################################

// Обработка тестового запроса
app.get("/test_request", (req, res) => {
    Utils.log(`Test request, IP: ${req.ip.slice(7)}`);
    res.send("Success from auth");
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
                        value: "/test_request"
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
