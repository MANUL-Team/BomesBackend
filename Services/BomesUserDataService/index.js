require("dotenv").config();
const WebSocketClient = require('websocket').client;
const mysql = require("mysql2");
const UserUtils = require("./UserUtils.js");

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


client.on("connect", (connection) => {
    const registerService = {
        event: "RegisterService",
        serviceName: "UserDataService",
        requests: ["GetUser", "GetUsers", "UpdateValue", "GetUserChats", "UpdateUserData", "GetUsersByIdentifiers"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        const request_user = message.request_user;
        switch(message.event){
            case "GetUser":
                if (request_user && request_user.identifier && request_user.password && message.identifier && message.clientID){
                    GetUser(con, connection, request_user.identifier, request_user.password, message.identifier, message.clientID);
                }
                break;
            case "GetUsers":
                if (request_user && request_user.identifier && request_user.password && message.clientID){
                    GetUsers(con, connection, request_user.identifier, request_user.password, message.skip, message.search, message.clientID);
                }
                break;
            case "GetUsersByIdentifiers":
                if (request_user && request_user.identifier && request_user.password && message.identifiers && message.clientID){
                    GetUsersByIdentifiers(con, connection, request_user.identifier, request_user.password, message.identifiers, message.clientID);
                }
                break;
            case "UpdateValue":
                if (message.table && message.variable && message.value && message.column && message.where){
                    UpdateUserValue(con, message.table, message.variable, message.value, message.column, message.where);
                }
                break;
            case "GetUserChats":
                if (request_user && request_user.identifier && request_user.password && message.clientID){
                    GetUserChats(con, connection, request_user.identifier, request_user.password, message.clientID);
                }
                break;
            case "UpdateUserData":
                if (message.name && request_user.identifier && message.clientID){
                    UpdateUserData(con, connection, message.name, message.description, request_user.identifier, message.clientID);
                }
                break;
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

async function GetUser(connection, ws, request_identifier, request_password, identifier, clientID) {
    await UserUtils.GetUserFromDB(connection, request_identifier).then(value => {
        if (value.password === request_password) {
            UserUtils.GetUserFromDB(connection, identifier).then(return_value => {
                let whichFriend = "";
                if (value.friends) {
                    if (value.friends.friends.includes(identifier))
                        whichFriend = "friend";
                    else if (value.friends.incomingRequests.includes(identifier))
                        whichFriend = "incomingRequest";
                    else if (value.friends.sentRequests.includes(identifier))
                        whichFriend = "sentRequest";
                }

                const user = {
                    username: return_value.username,
                    avatar: return_value.avatar,
                    email: return_value.email,
                    description: return_value.description,
                    identifier: return_value.identifier,
                    lastOnline: return_value.lastOnline,
                    whichFriend: whichFriend
                }
                const reply = {
                    user: user,
                    event: "ReturnUser",
                    clientID: clientID
                }
                ws.sendUTF(JSON.stringify(reply));
            });
        }
    });
}

async function GetUsers(connection, ws, identifier, password, skip, search, clientID){
    await UserUtils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            let sql;
            let data;
            let hasSkip = skip !== undefined;
            if (!skip) skip = 0
            if (search){
                sql = "SELECT * FROM `users` WHERE LOWER(username) LIKE '%" + search + "%'";
                data = [skip];
            }
            else{
                sql = "SELECT * FROM `users`";
                data = [skip];
            }
            if (hasSkip)
                sql += " ORDER BY id LIMIT ?, 20"
            
            connection.query(sql, data, function(err, result){
                if (err) console.log(err);
                else{
                    let returningUsers = [];
                    for (let i = 0; i < result.length; i++){
                        const current_user = result[i];
                        current_user.friends = JSON.parse(current_user.friends);
                        if (current_user.friends === null){
                            current_user.friends = {
                                sentRequests: [],
                                incomingRequests: [],
                                friends: []
                            };
                        }
                        let returningUser = {
                            id: current_user.id,
                            username: current_user.username,
                            avatar: current_user.avatar,
                            identifier: current_user.identifier,
                            friendsCount: current_user.friends.friends.length
                        };
                        returningUsers.push(returningUser);
                    }
                    let reply = {
                        event: "ReturnUsers",
                        users: returningUsers,
                        search: search !== undefined,
                        searchingName: search,
                        clientID: clientID
                    };
                    ws.sendUTF(JSON.stringify(reply));
                }
            });
        }
    });
}
function UpdateUserValue(connection, table, variable, value, column, where){
    if (variable !== "username" && variable !== "description") {
        const sql = "UPDATE `" + table + "` SET " + variable + " = ? WHERE " + column + " = ?";
        const data = [value, where];

        connection.query(sql, data, function (err, result) {
            if (err) console.log(err);
        });
    }
}
async function GetUserChats(connection, ws, identifier, password, clientID){
    await UserUtils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            UserUtils.GetUserChatsNames(connection, identifier).then((data) => {
                UserUtils.GetFullChatsFromSql(connection, data[0], data[1], data[2]).then(chats => {
                    const sql = "SELECT identifier FROM `users` WHERE currentOnline > 0;";
                    connection.query(sql, function(err, result){
                        if (err) console.log(err);
                        else{
                            const onlineUsers = result;
                            chats.forEach(chat => {
                                if (onlineUsers.findIndex(data => data.identifier === chat.user_identifier) !== -1)
                                    chat.lastOnline = 0;
                            });
                            const reply = {
                                chats: chats,
                                event: "ReturnUserChats",
                                clientID: clientID
                            }
                            ws.sendUTF(JSON.stringify(reply));
                        }
                    });
                });
            });
        }
    });
}
function UpdateUserData(connection, ws, name, description, where, clientID){
    if (UserUtils.matFilter(name) || UserUtils.matFilter(description)){
        let reply = {
            event: "MatDetected",
            clientID: clientID
        };
        ws.sendUTF(JSON.stringify(reply));
    }
    else {
        const sql = "UPDATE `users` SET username = ?, description = ? WHERE identifier = ?";
        const data = [name, description, where];

        connection.query(sql, data, function (err, result) {
            if (err) console.log(err);
            else{
                let reply = {
                    name: name,
                    description: description,
                    event: "WithoutMats",
                    clientID: clientID
                };
                ws.sendUTF(JSON.stringify(reply));
            }
        });
    }
}

async function GetUsersByIdentifiers(connection, ws, identifier, password, identifiers, clientID){
    await UserUtils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            let sql = CreateSQLQueryForGetUsers(identifiers);
            connection.query(sql, function(err, result){
                if (err) console.log(err);
                else{
                    if (result){
                        let returningResult = [];
                        for(let i = 0; i < result.length; i++){
                            let gettingUser = result[i];
                            let whichFriend = "";
                            if (gettingUser.friends) {
                                if (gettingUser.friends.friends && gettingUser.friends.friends.includes(identifier))
                                    whichFriend = "friend";
                                else if (gettingUser.friends.incomingRequests && gettingUser.friends.incomingRequests.includes(identifier))
                                    whichFriend = "incomingRequest";
                                else if (gettingUser.friends.sentRequests && gettingUser.friends.sentRequests.includes(identifier))
                                    whichFriend = "sentRequest";
                            }

                            const returningUser = {
                                username: gettingUser.username,
                                avatar: gettingUser.avatar,
                                email: gettingUser.email,
                                description: gettingUser.description,
                                identifier: gettingUser.identifier,
                                lastOnline: gettingUser.lastOnline,
                                whichFriend: whichFriend
                            }
                            returningResult.push(returningUser);
                        }
                        const reply = {
                            users: returningResult,
                            event: "ReturnUsersByIdentifiers",
                            clientID: clientID
                        }
                        ws.sendUTF(JSON.stringify(reply));
                    }
                }
            });
        }
    });
}
function CreateSQLQueryForGetUsers(identifiers){
    let sql = "SELECT * FROM `users` WHERE identifier in (";
    identifiers.forEach(identifier => {
        sql += "'" + identifier + "', ";
    });
    sql = sql.slice(0, -2);
    sql += ");";
    return sql;
}