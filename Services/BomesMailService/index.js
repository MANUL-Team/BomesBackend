// Импорт библиотек, установка констант и стандартных настроек express, подключение к базе данных
// #################################
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js"); // Импорт утилитных функций. См. файл Utils.js
const nodemailer = require('nodemailer');

const app = express();

const PORT = process.env.PORT;
const CORE_ADDRESS = process.env.CORE_ADDRESS;
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASSWORD = process.env.MAIL_PASSWORD;

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    auth: {
        user: MAIL_USER,
        pass: MAIL_PASSWORD,
    },
});

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));
// #################################


app.post("/send_mail", (req, res) => {
    req.body = JSON.parse(req.body.data);
    if (!req.body) return res.status(400).send({message: "Where is body?"});
    const mail = req.body.mail;
    if (!mail) return res.status(400).send({message: "Where is mail?"});
    if (!mail.from || !mail.to || !mail.subject || !mail.text || !mail.html)
        return res.status(400).send({message: "Where is one or more of these: mail.from, mail.to, mail.subject, mail.text, mail.html?"});
    transporter.sendMail(mail, (err, info) => {
        if (err) Utils.log(err);
        else {
            Utils.log(info);
            res.send({message: "Successful send"});
        }
    });
});

// Запуск сервера
app.listen(PORT, () => {
    Utils.log(`Сервер запущен на порту ${PORT}`);
});
