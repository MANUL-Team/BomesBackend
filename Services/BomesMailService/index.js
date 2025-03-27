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


client.on("connect", (connection) => {
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
});

client.connect(api_address, 'echo-protocol');

function SendMail(mail){
    try{
        transporter.sendMail(mail);
    }
    catch(err) {
        console.log("Can't send this mail: " + err);
    }
}