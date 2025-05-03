// Импорт библиотек, установка констант и стандартных настроек express, подключение к базе данных
// ###################################################################################################
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js"); // Импорт утилитных функций. См. файл Utils.js
const mysql = require("mysql2");

const app = express();

const PORT = process.env.PORT;
const CORE_ADDRESS = process.env.CORE_ADDRESS;
const MAIL_ADDRESS = process.env.MAIL_ADDRESS;
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
// ###################################################################################################

app.post("/register", (req, res) => {
    req.body = JSON.parse(req.body.data);
    if (!req.body) return res.status(400).send("Where is body?");
    const user = req.body.user;
    if (!user) return res.status(400).send("Where is user?");
    if (!user.email) return res.status(400).send("Where is user.email?");
    const getUserSQL = "SELECT 1 FROM `Users` WHERE email = ?";
    const getUserData = [user.email];
    database.query(getUserSQL, getUserData, (err, result) => {
        if (err) return Utils.error(err);
        if (result.length) return res.send("Email already used!");
        res.send("Good email!");
        const code = Utils.getRandomInt(100000, 999999);

        // Send mail...
        sendPostToHttp(
            `http://${MAIL_ADDRESS}/send_mail`,
            {
                mail: {
                    from: '"Администрация Bomes" <mainadmin@bomes.ru>',
                    to: user.email,
                    subject: 'Код для подтверждения почты: ' + code,
                    text: 'Ваш код для подтверждения почты' + code,
                    html: '<h1>Подтвердите почту используя код: <b>' + code + '</b></h1>',
                }
            },
            (err, response, body) => {
                if (err) return Utils.error(err);
                Utils.log(`Mail result: ${body}`);

            }
        );

        const addToConfirmationsSQL = "REPLACE INTO `Confirmations` SET `email` = ?, `code` = ?";
        const addToConfirmationsData = [user.email, code];
        database.query(addToConfirmationsSQL, addToConfirmationsData, (err, result) => {
            if (err) Utils.error(err);
        });
    });
});

app.post("/confirm_email", (req, res) => {
    req.body = JSON.parse(req.body.data);
    if (!req.body) return res.status(400).send("Where is body?");
    const confirmation_data = req.body.confirmation_data;
    if (!confirmation_data) return res.status(400).send("Where is confirmation_data?");
    if (!confirmation_data.email || !confirmation_data.password || !confirmation_data.fullname || !confirmation_data.code)
        return res.status(400).send("Where is one or more of these: confirmation_data.email, confirmation_data.password, confirmation_data.fullname, confirmation_data.code?");
    const getConfirmationSQL = "SELECT 1 FROM `Confirmations` WHERE email = ? AND code = ?";
    const getConfirmationData = [confirmation_data.email, confirmation_data.code];
    database.query(getConfirmationSQL, getConfirmationData, (err, result) => {
        if (err) return Utils.error(err);
        if (!result.length) return res.send("Wrong email or code!");
        res.send("Good code!");
        const removeConfirmationsSQL = "DELETE FROM `Confirmations` WHERE email = ?";
        const removeConfirmationsData = [confirmation_data.email];
        database.query(removeConfirmationsSQL, removeConfirmationsData, (err, result) => {
            if (err) Utils.error(err);
        });
        const addToUsersSQL = "INSERT INTO `Users` (email, password, fullname) VALUES (?, ?, ?)";
        const addToUsersData = [confirmation_data.email, confirmation_data.password, confirmation_data.fullname];
        database.query(addToUsersSQL, addToUsersData, (err, result) => {
            if (err) Utils.error(err);
        });
    });
});

app.post("/login", (req, res) => {
    req.body = JSON.parse(req.body.data);
    if (!req.body) return res.status(400).send("Where is body?");
    const user = req.body.user;
    if (!user) return res.status(400).send("Where is user?");
    if (!user.email || !user.password)  return res.status(400).send("Where is one or more of these: user.email, user.password?");
    const getUserSQL = "SELECT * FROM `Users` WHERE email = ?";
    const getUserData = [user.email];
    database.query(getUserSQL, getUserData, (err, result) => {
        if (err) return Utils.error(err);
        if (!result.length) return res.send("User not found!");
        const databaseUser = result[0];
        if (databaseUser.password !== user.password) return res.send("Wrong password!");
        databaseUser.password = undefined;
        res.send({
            message: "Successful login",
            data: databaseUser
        });
    });
});

// Запуск сервера
app.listen(PORT, () => {
    Utils.log(`Сервер запущен на порту ${PORT}`);
});

// Отправка запроса на регистрацию в ядро

sendPostToHttp(
    `http://${CORE_ADDRESS}/register_service`, 
    {
        port: PORT,
        requests: [
            {
                type: "POST",
                value: "/register"
            },
            {
                type: "POST",
                value: "/confirm_email"
            },
            {
                type: "POST",
                value: "/login"
            }
        ]
    },
    (err, response, body) => {
        if (err) return Utils.error(err);
        Utils.log("REGISTERED!");
    }
);

function sendPostToHttp(address, data, onresult) {
    request.post(
        {
            url: address,
            form: {data: JSON.stringify(data)}
        },
        onresult
    );
}
