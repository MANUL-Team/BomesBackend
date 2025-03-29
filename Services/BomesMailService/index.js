require("dotenv").config();
const WebSocketClient = require('websocket').client;
const nodemailer = require('nodemailer');

const api_address = process.env.API_ADDRESS;
const mail_user = process.env.MAIL_USER;
const mail_password = process.env.MAIL_PASSWORD;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new WebSocketClient();

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    auth: {
        user: mail_user,
        pass: mail_password,
    },
});

let reconnectionInterval

client.on("connect", (connection) => {
    if (reconnectionInterval) {
        clearInterval(reconnectionInterval)
        reconnectionInterval = undefined
    }

    const registerService = {
        event: "RegisterService",
        serviceName: "MailService",
        requests: ["SendMail"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "SendMail":
                SendMail(message.mail);
                break;
        }
    
    });
    connection.on("close", (code, desc) => {
        reconnectionInterval = setInterval(() => {
            if (!connection.connected) {
                client.connect(api_address, 'echo-protocol');
            }
        }, 3000)
    });
});

client.connect(api_address, 'echo-protocol');

function SendMail(mail){
    transporter.sendMail(mail, (err, info) => {
        if (err) console.log(err);
        else {
            console.log(info);
        }
    });
}