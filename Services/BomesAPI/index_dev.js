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


const services = {};
const requestsHandlers = {};
let serviceID = 1;
const servicesList = [];

const clients = {};
let clientID = 0;

const connected_clients = {};

wss.on("connection", (ws, req) => {
    RegisterClient(ws);
    ws.on("message", (message) => {
        try{
            message = message.toString();
            console.log(message);
            if (ws.clientID && connected_clients[ws.clientID]) {
                message = decrypt(message);
                console.log(message);
            }
            message = JSON.parse(message);

            if (message.event === "RegisterService" && !ws.serviceID){
                RegisterService(message.serviceName, ws, message.requests);
            }
            else if (message.event === "ConnectUser"){
                ConnectUser(ws, message.identifier, message.password, ws.clientID, message.key);
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
                data: "Incorrect key",
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
        if (connected_clients[id]) {
            data = encrypt(data);
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
        password: password
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

function encrypt(message) {
    let result = "";
    for (let i = 0; i < message.length; i++) {
        result += String.fromCharCode(message.charCodeAt(i) << 5);
    }
    return result;
}

function decrypt(message) {
    let result = "";
    for (let i = 0; i < message.length; i++) {
        result += String.fromCharCode(message.charCodeAt(i) >> 5);
    }
    return result;
}
