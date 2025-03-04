require("dotenv").config();
const WebSocketClient = require('websocket').client;
const mysql = require("mysql2");
const Utils = require("./Utils");

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
    else{
        console.log("Success SQL connection!");
        con.query("UPDATE `users` SET currentOnline = 0", function(err, result){
            if (err) console.log(err);
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


const onlineUsers = [];

client.on("connect", (connection) => {
    const registerService = {
        event: "RegisterService",
        serviceName: "UserControlsService",
        requests: ["IsUserOnline", "SetToken"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "IsUserOnline":
                IsUserOnline(con, connection, message.identifier, message.clientID);
                break;
            case "SetToken":
                SetToken(con, message.identifier, message.password, message.token);
                break;
            default:
                console.log(message);
        }
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

function IsUserOnline(connection, ws, identifier, clientID){
    const sql = "SELECT COUNT(*) FROM `users` WHERE identifier = ? and currentOnline > 0;";
    connection.query(sql, [identifier], function(err, result){
        if (err) console.log(err);
        else{
            const reply = {
                isOnline: result[0]['COUNT(*)'] > 0,
                event: "ReturnOnline",
                clientID: clientID
            };
            ws.sendUTF(JSON.stringify(reply));
        }
    });
}

async function SetToken(connection, identifier, password, token){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            if (!user.tokens){
                user.tokens = [];
            }
            if (user.tokens.indexOf(token) === -1){
                user.tokens.push(token);

                const sql = "UPDATE `users` SET tokens = ? WHERE identifier = ?";
                const data = [JSON.stringify(user.tokens), identifier];

                connection.query(sql, data, function (err, result) {
                    if (err) console.log(err);
                });
            }
        }
    });
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
