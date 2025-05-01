// Импорт библиотек, установка констант и стандартных настроек express
// #################################
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js"); // Импорт утилитных функций. См. файл Utils.js
const mysql = require("mysql2");

const app = express();

const PORT = process.env.PORT;
const CORE_ADDRESS = process.env.CORE_ADDRESS;
const database_host = process.env.DATABASE_ADDRESS;
const database_user = process.env.DATABASE_USERNAME;
const database_password = process.env.DATABASE_PASSWORD;
const database_name = process.env.DATABASE_NAME;

const connectionConfig = {
    host: database_host,
    user: database_user,
    password: database_password,
    database: database_name
}

let database = mysql.createConnection(connectionConfig);
database.connect(function (err) {
    if (err) Utils.error(err);
    else Utils.log("Success SQL connection!");
});

const emails = ["Hello", "TestTest", "Abrakadabra"];

for (let i = 0; i < 10000000; i++) {
    const sql = 'INSERT INTO test_table (email, password) VALUES (?, ?);';
    const data = [emails[i % emails.length], emails[i % emails.length]];
    database.query(sql, data, (err, results) => {
        if (err) Utils.error(err);
    });
}


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
