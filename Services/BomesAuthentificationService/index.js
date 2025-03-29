require("dotenv").config();
const WebSocketClient = require('websocket').client;
const mysql = require("mysql2");
const Utils = require("./Utils");
const hashingMD5 = require("crypto-js/md5.js");

const api_address = process.env.API_ADDRESS;
const database_host = process.env.DATABASE_ADDRESS;
const database_user = process.env.DATABASE_USERNAME;
const database_password = process.env.DATABASE_PASSWORD;
const database_name = process.env.DATABASE_NAME;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionConfig = {
    host: database_host,
    user: database_user,
    password: database_password,
    database: database_name
}

let con = mysql.createConnection(connectionConfig);
con.connect(function (err) {
    if (err) console.error(err);
    else console.log("Success SQL connection!");
})
con.on("error", function (err){
    reconnectingDatabase();
});
con.on("close", function (err){
    reconnectingDatabase();
});

setInterval(() => {
    const sql = "SELECT 1;";
    con.query(sql, function (err, result){
        if (err) console.log(err);
    });
}, 1800000);

const client = new WebSocketClient();

const confirmingUsers = [];

let reconnectionInterval

client.on("connect", (connection) => {
    if (reconnectionInterval) {
        clearInterval(reconnectionInterval)
        reconnectionInterval = undefined
    }
    const registerService = {
        event: "RegisterService",
        serviceName: "AuthentificationService",
        requests: ["RegisterUser", "ConfirmEmail", "Login"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "RegisterUser":
                TryToRegisterUser(con, connection, message.email, message.password, message.username, message.clientID);
                break;
            case "ConfirmEmail":
                ConfirmEmail(con, connection, message.email, message.code, message.clientID);
                break;
            case "Login":
                TryToLoginUser(con, connection, message.email, message.password, message.clientID);
                break;
            default:
                console.log(message);
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

client.on("connectFailed", (errorDescription) => {
    console.log("FAIL TO CONNECT!");
    console.log(errorDescription);
});

client.connect(api_address, "echo-protocol");


function reconnectingDatabase(){
    console.log("Reconnecting database...");
    con.destroy();
    con = mysql.createConnection(connectionConfig);
    con.connect(function (err) {
        if (err) console.error(err);
        else console.log("Success SQL reconnection!");
    });
}

function TryToRegisterUser(connection, ws, email, password, username, clientID){
    const index = confirmingUsers.findIndex(user => user.email === email);
    if (index !== -1) confirmingUsers.splice(index, 1);
    const sql = 'SELECT * FROM `users` WHERE email = ?';
    const data = [email];
    connection.query(sql, data, function (err, results) {
        if(err) console.log(err);
        else{
            if (results.length){
                const message = {
                    event: "EmailAlreadyUsed",
                    clientID: clientID
                }
                ws.sendUTF(JSON.stringify(message));
            }
            else {
                const reply = {
                    event: "GreatEmail",
                    clientID: clientID
                }
                ws.sendUTF(JSON.stringify(reply));
                const code = Utils.getRandomInt(100000, 999999);
                
                const request_to_mail_service = {
                    mail: {
                        from: '"Администрация Bomes" <mainadmin@bomes.ru>',
                        to: email,
                        subject: 'Код для подтверждения почты: ' + code,
                        text: 'Ваш код для подтверждения почты' + code,
                        html: '<h1>Подтвердите почту используя код: <b>' + code + '</b></h1>',
                    },
                    service: "MailService",
                    event: "SendMail"
                }

                ws.sendUTF(JSON.stringify(request_to_mail_service));
                const confirmingUser = {
                    email: email,
                    password: password,
                    username: username,
                    code: code
                }
                confirmingUsers.push(confirmingUser);
            }
        }
    });
}

function ConfirmEmail(connection, ws, email, code, clientID){
    const index = confirmingUsers.findIndex(user => user.email === email);
    if (index !== -1) {
        user = confirmingUsers[index];
        if (user.code === code){
            const emailHash = hashingMD5(user.email).toString();
            const userIdentifier = hashingMD5(emailHash + user.password).toString();

            const sql = 'INSERT INTO `users` (identifier, email, password, username, avatar, description) VALUES (?, ?, ?, ?, ?, ?)';
            const data = [userIdentifier, user.email, user.password, user.username, "", ""];
            connection.query(sql, data, function (err, results) {
                if (err) console.log(err);
                else{
                    const sql = 'CREATE TABLE `' + userIdentifier + "-chats" + '` (id integer NOT NULL PRIMARY KEY AUTO_INCREMENT, table_name text, chat_name text, isLocalChat integer, notRead integer, lastMessage text);';
                    connection.query(sql, function (err, results) {
                        if (err) console.log(err);
                        else{
                            const message = {
                                userIdentifier: userIdentifier,
                                email: user.email,
                                password: user.password,
                                username: user.username,
                                avatar: user.avatar,
                                description: user.description,
                                event: "RightCode",
                                clientID: clientID
                            }
                            ws.sendUTF(JSON.stringify(message));
                            confirmingUsers.splice(index, 1);

                            const request_to_monitoring_service = {
                                service: "MonitoringService",
                                event: "UpdateData",
                                type: "AddNewUser",
                            }
                            ws.sendUTF(JSON.stringify(request_to_monitoring_service));
                        }
                    });
                }
            });
        }
        else{
            const message = {
                event: "WrongCode",
                clientID: clientID
            }
            ws.sendUTF(JSON.stringify(message));
        }
    }
}

function TryToLoginUser(connection, ws, email, password, clientID){
    const sql = 'SELECT * FROM `users` WHERE email = ?';
    const data = [email];
    connection.query(sql, data, function (err, result){
        if (err) console.log(err);
        else{
            const value = result[0];
            if (value) {
                if (password === value.password) {
                    const reply = {
                        identifier: value.identifier,
                        email: email,
                        password: password,
                        username: value.username,
                        avatar: value.avatar,
                        description: value.description,
                        event: "TruePassword",
                        clientID: clientID
                    }
                    ws.sendUTF(JSON.stringify(reply));
                } else {
                    const reply = {
                        event: "WrongPassword",
                        clientID: clientID
                    }
                    ws.sendUTF(JSON.stringify(reply));
                }
            }
            else{
                const reply = {
                    event: "UserNotFound",
                    clientID: clientID
                }
                ws.sendUTF(JSON.stringify(reply));
            }
        }
    });
}
