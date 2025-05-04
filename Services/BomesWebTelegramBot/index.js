require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js"); // Импорт утилитных функций. См. файл Utils.js
const TelegramBot = require('node-telegram-bot-api');

const app = express();

const PORT = process.env.PORT;
const api_address = process.env.API_ADDRESS;
const API_KEY_BOT = process.env.API_KEY_BOT;

const bot = new TelegramBot(API_KEY_BOT, {
    polling: true
});

const notify_chats = [];
const error_notify_chats = [];
const all_notify_chats = [];

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));
// #################################

bot.on('text', async msg => {
    try {
        if(msg.text == '/register_chat') {
            const index = notify_chats.indexOf(msg.chat.id);
            if (index === -1){
                notify_chats.push(msg.chat.id);
                await bot.sendMessage(msg.chat.id, `Чат успешно зарегистрирован!`);
            }
            else{
                await bot.sendMessage(msg.chat.id, `Чат уже зарегистрирован!`);
            }
        }
        else if (msg.text == "/remove_chat"){
            const index = notify_chats.indexOf(msg.chat.id);
            if (index !== -1){
                notify_chats.splice(index, 1);
                await bot.sendMessage(msg.chat.id, `Чат успешно удален!`);
            }
            else{
                await bot.sendMessage(msg.chat.id, `Этот чат и не был зарегистрирован!`);
            }
        }
        else if (msg.text == "/get_error_requests"){
            const index = error_notify_chats.indexOf(msg.chat.id);
            if (index === -1){
                error_notify_chats.push(msg.chat.id);
                await bot.sendMessage(msg.chat.id, `Теперь вам будут приходить все ошибочные запросы!`);
            }
            else{
                await bot.sendMessage(msg.chat.id, `Вам уже приходят все ошибочные запросы!`);
            }
        }
        else if (msg.text == "/remove_error_requests"){
            const index = error_notify_chats.indexOf(msg.chat.id);
            if (index !== -1){
                error_notify_chats.splice(index, 1);
                await bot.sendMessage(msg.chat.id, `Теперь вам не будут приходить все ошибочные запросы!`);
            }
            else{
                await bot.sendMessage(msg.chat.id, `Вам и так не приходят все ошибочные запросы!`);
            }
        }
    }
    catch(error) {
        console.log(error);
    }
});

// Обработка тестового запроса
app.get("/test_request", (req, res) => {
    Utils.log(`Test request, IP: ${req.ip.slice(7)}`);
    res.send("Success from auth");
});


app.post("/register_notification", (req, res) => {
    if (!req.body) return res.sendStatus(400);
    Utils.log(`Register notification, IP: ${req.ip.slice(7)}`);
    req.body = JSON.parse(req.body.data);
    RegisterNotification(req)
});


app.post("/remove_notification", (req, res) => {
    if (!req.body) return res.sendStatus(400);
    Utils.log(`Remove notification, IP: ${req.ip.slice(7)}`);
    req.body = JSON.parse(req.body.data);
    RemoveNotification(req)
});


app.post("/error_request_notification", (req, res) => {
    if (!req.body) return res.sendStatus(400);
    Utils.log(`Error request notification, IP: ${req.ip.slice(7)}`);
    req.body = JSON.parse(req.body.data);
    ErrorRequestNotification(req)
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
                    },
                    {
                        type: "POST",
                        value: "/register_notification"
                    },
                    {
                        type: "POST",
                        value: "/remove_notification"
                    },
                    {
                        type: "POST",
                        value: "/error_request_notification"
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

function RegisterNotification(serviceName) {
    notify_chats.forEach(async (chat) => {
        await bot.sendMessage(chat, `Сервис ${serviceName} был подключен!`);
    });
}

function RemoveNotification(serviceName) {
    notify_chats.forEach(async (chat) => {
        await bot.sendMessage(chat, `Сервис ${serviceName} был отключен!`);
    });
}

function ErrorRequestNotification(message) {
    error_notify_chats.forEach(async (chat) => {
        await bot.sendMessage(chat, `Ошибочный запрос: \n ${JSON.stringify(message)}`);
    });
}