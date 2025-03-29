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

let reconnectionInterval

client.on("connect", (connection) => {
    if (reconnectionInterval) {
        clearInterval(reconnectionInterval)
        reconnectionInterval = undefined
    }
    const registerService = {
        event: "RegisterService",
        serviceName: "GettingDataService",
        requests: ["GetStickers", "GetReactions", "GetCurrentAndroidVersion"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "GetStickers":
                GetStickers(con, connection, message.clientID);
                break;
            case "GetReactions":
                GetReactions(con, connection, message.clientID);
                break;
            case "GetCurrentAndroidVersion":
                GetCurrentAndroidVersion(con, connection, message.clientID);
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

function GetStickers(connection, ws, clientID){
    const sql = "SELECT * FROM `stickers`";
    connection.query(sql, function(err, result){
        if (err) console.log(err);
        else{
            let stickers = [];
            let hints = [];
            result.forEach(data => {
                stickers.push(data.path);
                hints.push(JSON.parse(data.hints));
            });
            const request = {
                stickers: stickers,
                hints: hints,
                event: "ReturnStickers",
                clientID: clientID
            };
            ws.sendUTF(JSON.stringify(request));
        }
    });
}

function GetReactions(connection, ws, clientID){
    const sql = "SELECT * FROM `reactions`";
    connection.query(sql, function(err, result){
        if (err) console.log(err);
        else{
            let reactionsURLs = [];
            result.forEach(data => {
                reactionsURLs.push(data.path);
            });
            const request = {
                reactionsURLs: reactionsURLs,
                event: "ReturnReactions",
                clientID: clientID
            };
            ws.sendUTF(JSON.stringify(request));
        }
    });
}

function GetCurrentAndroidVersion(connection, ws, clientID){
    const getVersion = "SELECT value FROM `values` WHERE dataType = 'CurrentAndroidVersion';";
    connection.query(getVersion, function(err, result){
        if (err) console.log(err);
        else{
            let ver = result[0].value;
            const returnVersion = {
                version: ver,
                event: "ReturnCurrentAndroidVersion",
                clientID: clientID
            };
            ws.sendUTF(JSON.stringify(returnVersion));
        }
    });
}
