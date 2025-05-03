// Импорт библиотек, установка констант и стандартных настроек express, подключение к базе данных
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

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));
// #################################

app.post("/register", (req, res) => {
    req.body = JSON.parse(req.body.data);
    if (!req.body) return res.status(400).send("Where body?");
    const user = req.body.user;
    if (!user) return res.status(400).send("Where user?");
    if (!user.email || !user.password || !user.fullname) return res.status(400).send("Where one or more of these: user.email, user.password, user.fullname?");
    const getUserSQL = "SELECT 1 FROM `Users` WHERE email = ?";
    const getUserData = [user.email];
    database.query(getUserSQL, getUserData, (err, result) => {
        if (err) Utils.error(err);
        else {
            if (result.length) res.send("Email already used!");
            else{
                res.send("Good email!");
                const code = Utils.getRandomInt(100000, 999999);

                // Send mail...

                const addToConfirmationsSQL = "REPLACE INTO `Confirmations` SET `email` = ?, `password` = ?, `fullname` = ?, `code` = ?";
                const addToConfirmationsData = [user.email, user.password, user.fullname, code];
                database.query(addToConfirmationsSQL, addToConfirmationsData, (err, result) => {
                    if (err) Utils.error(err);
                });
            }
        }
    });
});

app.post("/confirm_email", (req, res) => {
    req.body = JSON.parse(req.body.data);
    if (!req.body) return res.status(400).send("Where body?");
    const confirmation_data = req.body.confirmation_data;
    if (!confirmation_data) return res.status(400).send("Where confirmation_data?");
    if (!confirmation_data.email || !confirmation_data.code) return res.status(400).send("Where one or more of these: confirmation_data.email, confirmation_data.code?");
    const getConfirmationSQL = "SELECT 1 FROM `Confirmations` WHERE email = ? AND code = ?";
    const getConfirmationData = [confirmation_data.email, confirmation_data.code];
    database.query(getConfirmationSQL, getConfirmationData, (err, result) => {
        if (err) Utils.error(err);
        else {
            if (!result.length) res.send("Wrong code!");
            else {
                res.send("Good code!");
                const removeConfirmationsSQL = "DELETE FROM `Confirmations` WHERE email = ? AND code = ?";
                const removeConfirmationsData = [confirmation_data.email, confirmation_data.code];
                database.query(removeConfirmationsSQL, removeConfirmationsData, (err, result) => {
                    if (err) Utils.error(err);
                });
            }
        }
    });
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
                        type: "POST",
                        value: "/register"
                    },
                    {
                        type: "POST",
                        value: "/confirm_email"
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
