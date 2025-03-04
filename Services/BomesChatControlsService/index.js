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
        serviceName: "ChatControlsService",
        requests: ["CreateChat", "GetChatMessages", "GetChatUsers", "RenameChat", "SwitchChatAvatar"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", async (message) => {
        message = JSON.parse(message.utf8Data);
        let request_user = message.request_user;
        if (!request_user) {
            if (message.request_identifier) {
                request_user = {
                    identifier: message.request_identifier,
                    password: message.request_password
                }
            }
            else {
                request_user = {
                    identifier: message.identifier,
                    password: message.password
                }
            }
        }
        switch(message.event){
            case "CreateChat":
                if (message.isLocalChat){
                    console.log("Local chat");
                    if (message.usersToAdd && message.chat_name && message.clientID)
                        await CreateLocalChat(con, connection, database_name, message.usersToAdd, message.chat_name, message.clientID);
                }
                else if (!message.isLocalChat){
                    console.log("Creating group chat!");
                    if (message.usersToAdd && message.chat_name && message.owner)
                        await CreateGroupChat(con, connection, database_name, message.usersToAdd, message.chat_name, message.avatar, message.owner, message.clientID);
                }
                else{
                    console.log("You are stupid ahaha");
                }
                break;
            case "GetChatMessages":
                if (message.table_name && request_user.identifier && request_user.password && message.clientID)
                    await GetChatMessages(con, connection, message.table_name, request_user.identifier, request_user.password, message.loadedMessages, message.clientID);
                break;
            case "GetChatUsers":
                if (request_user.identifier && request_user.password && message.table_name && message.clientID)
                    await GetChatUsers(con, connection, request_user.identifier, request_user.password, message.table_name, message.clientID);
                break;
            case "RenameChat":
                if (request_user.identifier && request_user.password && message.name && message.chatIdentifier && message.clientID){
                    await RenameChat(con, connection, request_user.identifier, request_user.password, message.name, message.chatIdentifier, message.clientID);
                }
                break;
            case "SwitchChatAvatar":
                if (request_user.identifier && request_user.password && message.avatar && message.chatIdentifier && message.clientID){
                    await SwitchChatAvatar(con, connection, request_user.identifier, request_user.password, message.avatar, message.chatIdentifier, message.clientID);
                }
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

async function CreateLocalChat(database_connection, ws, database_name, users_to_add, chat_name, clientID) {
    users_to_add.sort();
    const table_name = Utils.GetTableName(users_to_add, true);
    await Utils.ChatAlreadyCreated(database_connection, database_name, table_name).then(isAlreadyCreated => {
        if (isAlreadyCreated) Utils.SendChatCreated(ws, table_name, chat_name, 1, clientID);
        else{
            Utils.CreateChatMainTable(database_connection, table_name).then(created => {
                if (users_to_add[0] !== users_to_add[1]){
                    Utils.AddChatIntoUserPrivateTable(database_connection, table_name, users_to_add[0], users_to_add[1]).then(created => {
                        Utils.AddChatIntoUserPrivateTable(database_connection, table_name, users_to_add[1], users_to_add[0]).then(created => {
                            Utils.AddChatIntoChatsTable(database_connection, table_name, users_to_add, 1).then(added => {
                                Utils.CreateChatMembersTable(database_connection, table_name, users_to_add).then(created => {
                                    Utils.SendChatCreated(ws, table_name, chat_name, 1, clientID);
                                });
                            });
                        });
                    });

                }
                else{
                    Utils.AddChatIntoUserPrivateTable(database_connection, table_name, users_to_add[0], users_to_add[0]).then(created => {
                        Utils.AddChatIntoChatsTable(database_connection, table_name, users_to_add, 1).then(added => {
                            Utils.CreateChatMembersTable(database_connection, table_name, users_to_add).then(created => {
                                Utils.SendChatCreated(ws, table_name, chat_name, 1, clientID);
                            });
                        });
                    });
                }
            });
        }
    });
}
async function CreateGroupChat(database_connection, ws, database_name, users_to_add, chat_name, avatar, owner, clientID) {
    const table_name = Utils.GetTableName(users_to_add, false);
    await Utils.ChatAlreadyCreated(database_connection, database_name, table_name).then(isCreated => {
        if (isCreated) Utils.SendChatCreated(ws, table_name, chat_name, 0, clientID);
        else{
            Utils.CreateChatMainTable(database_connection, table_name).then(created => {
                users_to_add.forEach(user => {
                    Utils.AddChatIntoUserPrivateTable(database_connection, table_name, user, chat_name).then(added => {
                    });
                });
                Utils.AddGroupChatIntoChatsTable(database_connection, table_name, chat_name, 0, avatar).then(added => {
                    Utils.CreateGroupChatMembersTable(database_connection, table_name, users_to_add, owner).then(created => {
                        Utils.SendChatCreated(ws, table_name, chat_name, 0, clientID);
                    });
                });
            });
        }
    });
}

async function GetChatMembers(connection, table_name){
    const sql = "SELECT identifier FROM `" + table_name + "-members`";
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
            if (err) console.log(err);
            let users = [];
            let promises = [];
            result.forEach(r => {
                promises.push(new Promise((resolve, reject) => {
                    const getUserSql = "SELECT * FROM `users` WHERE identifier = ?";
                    connection.query(getUserSql, [r.identifier], (err, res) => {
                        if (err) console.log(err);
                        users.push(res[0]);
                        resolve(res);
                    });
                }));
            });
            
            Promise.all(promises).then((values) => {
                resolve(users);
            });
        });
    });
}

async function GetChatMessages(connection, ws, table_name, request_identifier, request_password, skip, clientID){
    await Utils.GetUserFromDB(connection, request_identifier).then(value => {
        if (value.password === request_password) {
            const sql = "SELECT * FROM `" + table_name + "` ORDER BY id DESC LIMIT ?, 50";
            connection.query(sql, [skip], function (err, result){
                if (err) console.log(err);
                else{
                    let messages = [];
                    GetChatMembers(connection, table_name).then(users => {
                        result.forEach((message) => {
                            let index = users.findIndex(user => user.identifier === message.sender);
                            message.username = users[index].username;
                            message.avatar = users[index].avatar;
                            if (message.reply){
                                message.reply = JSON.parse(message.reply);
                                if (message.reply.reaction)
                                    try{
                                        message.reply.reaction = JSON.parse(message.reply.reaction);
                                    }
                                    catch(ex){}
                                else
                                    message.reply.reaction = [];
                                message.reply = JSON.stringify(message.reply);
                            }
                            if (message.reaction)
                                message.reaction = JSON.parse(message.reaction);
                            else
                                message.reaction = [];
                            messages.push(message);
                        });
                        const reply = {
                            messages: messages,
                            chat: table_name,
                            event: "ReturnChatMessages",
                            clientID: clientID
                        };
                        ws.sendUTF(JSON.stringify(reply));
                    });
                }
            });
            if (skip === 0){
                const updNotReadSql = "UPDATE `" + request_identifier + "-chats" + "` SET notRead = 0 WHERE table_name = ?";
                const updData = [table_name];
                connection.query(updNotReadSql, updData, function (err, result){
                    if (err) console.log(err);
                });
            }
        }
    });
}

async function GetChatUsers(connection, ws, identifier, password, table_name, clientID){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            GetChatMembers(connection, table_name).then(members => {
                members.forEach(member => {
                    member.friends = member.friends.friends;
                    member.tokens = undefined;
                    member.password = undefined;
                    member.email = undefined;
                    member.id = undefined;
                });
                let returnChatUsers = {
                    members: members,
                    event: "ReturnChatUsers",
                    clientID: clientID
                };
                ws.sendUTF(JSON.stringify(returnChatUsers));
            });
        }
    });
}

async function RenameChat(connection, ws, identifier, password, name, chatIdentifier, clientID){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            if (name !== ""){
                const sql = "UPDATE `chats` SET chatName = ? WHERE identifier = ?;";
                const data = [name, chatIdentifier];
                connection.query(sql, data, function (err, result){
                    if (err) console.log(err);
                    else{
                        const reply = {
                            event: "SuccessfulRenaming",
                            name: name,
                            clientID: clientID
                        };
                        ws.sendUTF(JSON.stringify(reply));
                    }
                });
            }
        }
    });
}

async function SwitchChatAvatar(connection, ws, identifier, password, avatar, chatIdentifier, clientID){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            const sql = "UPDATE `chats` SET avatar = ? WHERE identifier = ?;";
            const data = [avatar, chatIdentifier];
            connection.query(sql, data, function (err, result){
                if (err) console.log(err);
                else{
                    const reply = {
                        event: "SuccessfulSwitchingChatAvatar",
                        avatar: avatar,
                        clientID: clientID
                    };
                    ws.sendUTF(JSON.stringify(reply));
                }
            });
        }
    });
}
