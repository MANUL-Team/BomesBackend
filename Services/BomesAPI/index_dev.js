require("dotenv").config();

const ws = require('ws');
const mysql = require("mysql2");
const rsa = require("node-rsa");
const Utils = require("./Utils");

const PORT = process.env.PORT;

const connectionConfig = {
    host: process.env.DATABASE_ADDRESS,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
}

let con = mysql.createConnection(connectionConfig);
con.connect(function (err) {
    if (err) console.error(err);
    else{
        console.log("Success SQL connection!");
        con.query("UPDATE `users` SET currentOnline = 0", function(err, result){
            if (err) console.log(err);
        });
    }
});

setInterval(() => {
    const sql = "SELECT 1;";
    con.query(sql, function (err, result){
        if (err) console.log(err);
    });
}, 1800000);


// PRODUCTION
// -----------------------------------------------------------------------------
//  const https = require('https');
//  const fs = require('fs');
//  const server = https.createServer({
//      cert: fs.readFileSync('./ssl/domain_name.crt'),
//      key: fs.readFileSync('./ssl/private.key'),
//      chain: fs.readFileSync('./ssl/chain.crt'),
//  });
//  const wss = new ws.Server({server});
//  server.listen(PORT, () => console.log(`Server started on ${PORT} with WSS`));
// -----------------------------------------------------------------------------

// DEVELOPMENT
// -----------------------------------------------------------------------------
const wss = new ws.Server({
   port: PORT
}, () => console.log(`Server started on ${PORT} with WS`));
// -----------------------------------------------------------------------------


const server_keys = generate_keys(256);

const services = {};
const requestsHandlers = {};
let serviceID = 1;
const servicesList = [];

const clients = {};
let clientID = 0;

const connected_clients = {};

Buffer.prototype.toArrayInteger = function(){
    if (this.length > 0) {
        const data = new Array(this.length);
        for (let i = 0; i < this.length; i=i+1)
            data[i] = this[i];
        return data;
    }
    return [];
}

wss.on("connection", (ws, req) => {
    RegisterClient(ws);
    ws.on("message", (message) => {
        try{
            console.log(message);
            if (ws.clientID && connected_clients[ws.clientID] && connected_clients[ws.clientID].public_key) {
                message = message.toArrayInteger();
                message = decrypt(message, server_keys.private_key);
                console.log(message);
            }
            message = JSON.parse(message);

            if (message.event === "RegisterService" && !ws.serviceID){
                RegisterService(message.serviceName, ws, message.requests);
            }
            else if (message.event === "ConnectUser"){
                ConnectUser(ws, message.identifier, message.password, ws.clientID, message.public_key);
            }
            else if (message.event === "DisconnectUser") {
                DisconnectUser(ws, ws.clientID);
            }
            else if (ws.clientID && !ws.serviceID){
                SendFromClientToService(ws, message);
            }
            else if (ws.serviceID && message.clientID){
                SendFromServiceToClient(ws, message);
            }
            else if (ws.serviceID && (message.service || message.serviceID)){
                SendFromServiceToService(ws, message);
            }
            else{
                console.log("Unknown request!");
                console.log(message);
            }
        }
        catch(err){
            console.log("Error: " + err);
            const reply = {
                event: "Error",
                data: err,
                clientID: ws.clientID
            }
            SendFromServiceToClient(ws, reply);
        }
    });
    ws.on("close", () => {
        if (ws.serviceName){
            RemoveService(ws);
        }
        if (ws.clientID){
            DisconnectUser(ws, ws.clientID);
            RemoveClient(ws);
        }
    });
});


function RegisterService(serviceName, ws, requests){
    RemoveClient(ws);
    for(let i = 0; i < requests.length; i++){
        requestsHandlers[requests[i]] = serviceName;
    }
    ws.serviceName = serviceName;
    ws.serviceID = serviceID;
    serviceID++;
    servicesList.push(ws);
    if (serviceName in services)
        services[serviceName].push(ws);
    else
        services[serviceName] = [ws];
    console.log(`Service ${serviceName} successfuly added!`);

    const message = {
        event: "RegisterNotification",
        serviceName: serviceName
    }
    if (services["TelegramBotService"] && services["TelegramBotService"].length > 0){
        services["TelegramBotService"][0].send(JSON.stringify(message));
    }
}

function RemoveService(ws){
    const index = services[ws.serviceName].findIndex(con => con.serviceID === ws.serviceID);
    if (index !== -1){
        services[ws.serviceName].splice(index, 1);
        console.log(`Service ${ws.serviceName} successfuly removed!`);
    }
    const indexInList = servicesList.findIndex(con => con.serviceID === ws.serviceID);
    if (indexInList !== -1)
        servicesList.splice(indexInList, 1);

    const message = {
        event: "RemoveNotification",
        serviceName: ws.serviceName
    }
    if (services["TelegramBotService"] && services["TelegramBotService"].length > 0){
        services["TelegramBotService"][0].send(JSON.stringify(message));
    }
}

function RegisterClient(ws){
    ws.clientID = clientID;
    clients[clientID] = ws;
    clientID++;
}

function RemoveClient(ws){
    clients[ws.clientID] = undefined;
    ws.clientID = undefined;
}

function SendFromClientToService(ws, message){
    const serviceName = requestsHandlers[message.event];
    const request_user = connected_clients[ws.clientID];

    if (services[serviceName] && services[serviceName].length > 0){
        message.clientID = ws.clientID;
        message.request_user = request_user;
        services[serviceName][0].send(JSON.stringify(message));
    }
    else{
        const errorReply = {
            event: "Error",
            data: "Sorry, we cannot answer this request"
        };
        ws.send(JSON.stringify(errorReply));

        if (services["TelegramBotService"] && services["TelegramBotService"].length > 0){
            services["TelegramBotService"][0].send(JSON.stringify(message));
        }
    }
}

function SendFromServiceToClient(ws, message){
    const id = message.clientID;
    if (clients.hasOwnProperty(id)){
        message.clientID = undefined;
        message.request_user = undefined;
        let data = JSON.stringify(message);
        if (connected_clients[id] && connected_clients[id].public_key) {
            data = encrypt(data, connected_clients[id].public_key);
        }
        clients[id].send(data);
    }
}

function SendFromServiceToService(ws, message){
    if (message.service){
        if (services[message.service] && services[message.service].length > 0){
            const serviceName = message.service;
            message.service = undefined;
            message.serviceID = ws.serviceID;
            services[serviceName][0].send(JSON.stringify(message));
        }
        else{
            const errorReply = {
                event: "Error",
                data: "Cannot send your data to this service!"
            }
            ws.send(JSON.stringify(errorReply));
        }
    }
    else if (message.serviceID){
        const index = servicesList.findIndex(con => con.serviceID === message.serviceID);
        if (index !== -1){
            message.serviceID = ws.serviceID;
            servicesList[index].send(JSON.stringify(message));
        }
        else{
            const errorReply = {
                event: "Error",
                data: "Cannot send your data to this service!"
            }
            ws.send(JSON.stringify(errorReply));
        }
    }
}

async function ConnectUser(ws, identifier, password, clientID, key){
    if (connected_clients[clientID])
        return;
    connected_clients[clientID] = {
        identifier: identifier,
        password: password,
        public_key: key
    }
    await Utils.GetUserFromDB(con, identifier).then(value => {
        if (value.password === password){
            AddNewOnlineUser(con, identifier);
            const request_to_monitoring_service = {
                event: "UpdateData",
                type: "AddOnline",
                user: {
                    identifier: identifier,
                    username: value.username
                }
            }
            if (services["MonitoringService"] && services["MonitoringService"].length > 0){
                services["MonitoringService"][0].send(JSON.stringify(request_to_monitoring_service));
            }
            if (services["MessagingService"] && services["MessagingService"].length > 0) {
                const request = {
                    event: "ConnectUser",
                    identifier: identifier,
                    password: password,
                    clientID: clientID
                }
                services["MessagingService"][0].send(JSON.stringify(request));
            }
            const reply = {
                event: "ReturnServerKey",
                public_key: server_keys.public_key
            }
            ws.send(JSON.stringify(reply));
        }
        else{
            let reply = {
                event: "WrongAuthInIdentifier"
            }
            ws.send(JSON.stringify(reply));
            connected_clients[clientID] = undefined;
        }
    });
}

function DisconnectUser(ws, clientID) {
    if (!connected_clients[clientID])
        return;

    const identifier = connected_clients[clientID].identifier;
    const password = connected_clients[clientID].password;

    const sql = "UPDATE `users` SET lastOnline = ? WHERE identifier = ?";
    const data = [Date.now() / 1000, identifier];
    con.query(sql, data, function (err, result) {
        if (err) console.log(err);
    });
    RemoveOnlineUser(con, identifier);
    connected_clients[clientID] = undefined;

    const request_to_monitoring_service = {
        event: "UpdateData",
        type: "RemoveOnline",
        user: {
            identifier: identifier
        }
    }
    if (services["MonitoringService"] && services["MonitoringService"].length > 0){
        services["MonitoringService"][0].send(JSON.stringify(request_to_monitoring_service));
    }
    
    const request_to_monitoring_service2 = {
        event: "RemoveUsersCountListener",
        clientID: clientID
    }
    if (services["MonitoringService"] && services["MonitoringService"].length > 0){
        services["MonitoringService"][0].send(JSON.stringify(request_to_monitoring_service2));
    }

    const request_to_monitoring_service3 = {
        event: "RemoveOnlineListener",
        clientID: clientID
    }
    if (services["MonitoringService"] && services["MonitoringService"].length > 0){
        services["MonitoringService"][0].send(JSON.stringify(request_to_monitoring_service3));
    }

    if (services["MessagingService"] && services["MessagingService"].length > 0) {
        const request = {
            event: "DisconnectUser",
            identifier: identifier,
            password: password,
            clientID: clientID
        }
        services["MessagingService"][0].send(JSON.stringify(request));
    }
}

function AddNewOnlineUser(connection, identifier){
    const sql = `UPDATE \`users\` SET currentOnline = currentOnline + 1 WHERE identifier = ?`;
    const data = [identifier];
    connection.query(sql, data, function (err, result) {
        if (err) console.log(err);
    });
}

function RemoveOnlineUser(connection, identifier){
    const sql = `UPDATE \`users\` SET currentOnline = currentOnline - 1 WHERE identifier = ?`;
    const data = [identifier];
    connection.query(sql, data, function (err, result) {
        if (err) console.log(err);
    });
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

function generate_keys(key_length){
    public_key = "------Bomes Public Key Begin------\n";
    private_key = "------Bomes Private Key Begin------\n";
    let trashSizeCode = getRandomInt(8, 33);
    public_key += String.fromCharCode(trashSizeCode + 80);
    private_key += String.fromCharCode((trashSizeCode + 20) * 5);
    for(let i = 0; i < key_length; i++){
        let code = getRandomInt(5, 15);
        public_key += String.fromCharCode(code + 80);
        private_key += String.fromCharCode((code + 20) * 5);
    }
    public_key += "\n------Bomes Public Key End------";
    private_key += "\n------Bomes Private Key End------";
    return {
        public_key,
        private_key
    };
}

function encrypt(message, public_key) {
    let key = public_key
        .replace("------Bomes Public Key Begin------\n", "")
        .replace("\n------Bomes Public Key End------", "");
    let trashSize = key.charCodeAt(0) - 80;
    key = key.slice(1, key.length);
    let codes = [];
    for (let i = 0; i < key.length; i++){
        codes.push(key.charCodeAt(i) - 80);
    }
    const trashArray = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let data = "";
    let addTrashData = () => {
        for (let i = 0; i < trashSize; i++){
            data += trashArray[getRandomInt(0, trashArray.length)];
        }
    }
    addTrashData();
    data += message;
    addTrashData();
    let result = [];
    for (let i = 0; i < data.length; i++) {
        result.push(data.charCodeAt(i) << codes[i % codes.length]);
    }
    return result;
}

function decrypt(message, private_key) {
    let key = private_key
        .replace("------Bomes Private Key Begin------\n", "")
        .replace("\n------Bomes Private Key End------", "");
    let trashSize = key.charCodeAt(0) / 5 - 20;
    key = key.slice(1, key.length);
    let codes = [];
    for (let i = 0; i < key.length; i++){
        codes.push(key.charCodeAt(i) / 5 - 20);
    }
    let result = "";
    for (let i = 0; i < message.length; i++) {
        result += String.fromCharCode(message[i] >> codes[i % codes.length]);
    }
    return result.slice(trashSize, result.length-trashSize);
}