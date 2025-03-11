require("dotenv").config();

const WebSocketClient = require('websocket').client;
const TelegramBot = require('node-telegram-bot-api');

const client = new WebSocketClient();

const api_address = process.env.API_ADDRESS;
const API_KEY_BOT = process.env.API_KEY_BOT;
const bot = new TelegramBot(API_KEY_BOT, {
    polling: true
});

const notify_chats = [];
const error_notify_chats = [];
const all_notify_chats = [];

client.on("connect", (connection) => {
    const registerService = {
        event: "RegisterService",
        serviceName: "TelegramBotService",
        requests: ["RegisterNotification", "RemoveNotification", "ErrorRequestNotification"]
    };
    connection.sendUTF(JSON.stringify(registerService));
    connection.on('message', (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "RegisterNotification":
                RegisterNotification(message.serviceName)
                break;
            case "RemoveNotification":
                RemoveNotification(message.serviceName)
                break;
            case "ErrorRequestNotification":
                ErrorRequestNotification(message)
                break;
            default: console.log(message)
        }
    })
})

client.connect(api_address, 'echo-protocol');

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