require("dotenv").config();
const WebSocketClient = require('websocket').client;
const mysql = require("mysql2");

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

let onlineUsers = [];
let numberOfUsers = 0;


let con = mysql.createConnection(connectionConfig);
con.connect(function (err) {
    if (err) console.error(err);
    else{
        console.log("Success SQL connection!");

        con.query("SELECT COUNT(*) FROM `users`", function(err, result){
            if (err) console.log(err);
            else if (result[0]){
                numberOfUsers = result[0]["COUNT(*)"];
                console.log(numberOfUsers);
            }
        });
        con.query("SELECT identifier, username, currentOnline FROM `users` WHERE currentOnline > 0;", function(err, result){
            if (err) console.log(err);
            else if (result){
                onlineUsers = result;
                console.log(onlineUsers);
            }
        });
    } 
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

const usersCountListeners = [];
const onlineListeners = [];

let reconnectionInterval

client.on("connect", (connection) => {
    if (reconnectionInterval) {
        clearInterval(reconnectionInterval)
        reconnectionInterval = undefined
    }
    const registerService = {
        event: "RegisterService",
        serviceName: "MonitoringService",
        requests: ["RegisterUsersCountListener", "RegisterOnlineListener", "GetCurrentOnline", "GetCurrentNumberOfUsers"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        let index;
        switch(message.event){
            case "RegisterUsersCountListener":
                usersCountListeners.push(message.clientID);
                NotifyUsersCount(con, connection, usersCountListeners);
                break;
            case "RegisterOnlineListener":
                onlineListeners.push(message.clientID);
                NotifyOnline(con, connection, onlineListeners);
                break;
            case "UpdateData":
                if (message.type === "AddOnline"){
                    index = onlineUsers.findIndex(u => u.identifier === message.user.identifier);
                    if (index !== -1){
                        onlineUsers[index].currentOnline += 1;
                    }
                    else{
                        message.user.currentOnline = 1;
                        onlineUsers.push(message.user);
                        NotifyOnline(con, connection, onlineListeners);
                    }
                }
                else if (message.type === "RemoveOnline"){
                    index = onlineUsers.findIndex(u => u.identifier === message.user.identifier);
                    if (index !== -1){
                        if (onlineUsers[index].currentOnline > 1){
                            onlineUsers[index].currentOnline -= 1;
                        }
                        else{
                            onlineUsers.splice(index, 1);
                            NotifyOnline(con, connection, onlineListeners);
                        }
                    }
                }
                else if (message.type === "AddNewUser"){
                    numberOfUsers++;
                    NotifyUsersCount(con, connection, usersCountListeners);
                }
                break;
            case "RemoveUsersCountListener":
                index = usersCountListeners.indexOf(message.clientID);
                if (index !== -1){
                    usersCountListeners.splice(index, 1);
                }
                break;
            case "RemoveOnlineListener":
                index = onlineListeners.indexOf(message.clientID);
                if (index !== -1){
                    onlineListeners.splice(index, 1);
                }
                break;
            case "GetCurrentOnline":
                GetCurrentOnline(connection, message.clientID);
                break;
            case "GetCurrentNumberOfUsers":
                GetCurrentNumberOfUsers(connection, message.clientID)
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


function reconnectingDatabase(){
    console.log("Reconnecting database...");
    con.destroy();
    con = mysql.createConnection(connectionConfig);
    con.connect(function (err) {
        if (err) console.error(err);
        else console.log("Success SQL reconnection!");
    });
}

function GetCurrentNumberOfUsers(ws, clientID){
    const request = {
        event: "ReturnCurrentNumberOfUsers",
        usersCount: numberOfUsers,
        clientID: clientID
    };
    ws.sendUTF(JSON.stringify(request));
}

function GetCurrentOnline(ws, clientID){
    const request = {
        event: "ReturnCurrentOnline",
        online: onlineUsers.length,
        users: onlineUsers,
        clientID: clientID
    };
    ws.sendUTF(JSON.stringify(request));
}

function NotifyUsersCount(connection, ws, usersCountListeners){
    const request = {
        event: "ReturnUsersCount",
        usersCount: numberOfUsers,
    };
    for (let i = 0; i < usersCountListeners.length; i++){
        request.clientID = usersCountListeners[i];
        ws.sendUTF(JSON.stringify(request));
    }
}

function NotifyOnline(connection, ws, onlineListeners){
    const request = {
        event: "ReturnOnlineUsers",
        online: onlineUsers.length,
        users: onlineUsers
    };
    for (let i = 0; i < onlineListeners.length; i++){
        request.clientID = onlineListeners[i];
        ws.sendUTF(JSON.stringify(request));
    }
}