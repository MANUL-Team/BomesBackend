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

const onlineUsers = [];
const chatsActiveUsers = {}; // Пары ключ (идентификатор чата) - значение (массив айди клиентов пользователей)
const usersChats = {}; // Пары ключ (айди клиента пользователя) - значение (идентификатор чата)

client.on("connect", (connection) => {
    const registerService = {
        event: "RegisterService",
        serviceName: "MessagingService",
        requests: ["OpenChat", "CloseChat", "SendMessage", "DeleteMessage", "EditMessage", "ReadMessage", "Typing", "AddReaction", "RemoveReaction"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", async (message) => {
        message = JSON.parse(message.utf8Data);
        let index;
        switch(message.event){
            case "ConnectUser":
                if (message.identifier && message.password && message.clientID)
                    ConnectUser(con, connection, message.identifier, message.password, message.clientID);
                break;
            case "DisconnectUser":
                if (message.clientID)
                    DisconnectUser(con, connection, message.clientID);
                break;
            case "OpenChat":
                if (message.chat_name && message.clientID){
                    CloseChatForUser(message.clientID);
                    OpenChatForUser(message.chat_name, message.clientID);
                }
                break;
            case "CloseChat":
                if (message.clientID){
                    CloseChatForUser(message.clientID);
                }
                break;
            case "SendMessage":
                index = onlineUsers.findIndex(user => user.clientID === message.clientID);
                if (index != -1){
                    const user = onlineUsers[index];
                    if (message.sender && message.dataType && message.value && message.sender === user.identifier){
                        await SendMessage(con, connection, message);
                    }
                }
                break;
            case "DeleteMessage":
                index = onlineUsers.findIndex(user => user.clientID === message.clientID);
                if (index != -1){
                    const user = onlineUsers[index];
                    if (message.id && message.chat){
                        await DeleteMessage(con, connection, user.identifier, user.password, message.id, message.chat);
                    }
                }
                break;
            case "EditMessage":
                index = onlineUsers.findIndex(user => user.clientID === message.clientID);
                if (index != -1){
                    const user = onlineUsers[index];
                    if (message.id && message.chat && message.value){
                        await EditMessage(con, connection, user.identifier, user.password, message.value, message.id, message.chat);
                    }
                }
                break;
            case "ReadMessage":
                if (message.id && message.chat){
                    ReadMessage(con, connection, message.id, message.chat);
                }
                break;
            case "Typing":
                Typing(connection, message);
                break;
            case "AddReaction":
                index = onlineUsers.findIndex(user => user.clientID === message.clientID);
                if (index != -1){
                    const user = onlineUsers[index];
                    if (message.chat && message.msgId && message.sender && message.type && user.identifier === message.sender){
                        AddReaction(con, connection, message.chat, message.msgId, message.sender, message.type);
                    }
                }
                break;
            case "RemoveReaction":
                index = onlineUsers.findIndex(user => user.clientID === message.clientID);
                if (index != -1){
                    const user = onlineUsers[index];
                    if (message.chat && message.msgId && message.sender && user.identifier === message.sender){
                        RemoveReaction(con, connection, message.chat, message.msgId, message.sender);
                    }
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

async function ConnectUser(connection, ws, identifier, password, clientID){
    const index = onlineUsers.findIndex(user => user.clientID === clientID);
    if (index !== -1)
        onlineUsers.splice(index, 1);
    await Utils.GetUserFromDB(connection, identifier).then(value => {
        if (value.password === password){
            let user = {
                identifier: identifier,
                clientID: clientID,
                username: value.username,
                password: password
            };
            onlineUsers.push(user);
        }
        else{
            let reply = {
                event: "WrongAuthInIdentifier",
                clientID: clientID
            }
            ws.sendUTF(JSON.stringify(reply));
        }
    });
}

function DisconnectUser(connection, ws, clientID) {
    let index = onlineUsers.findIndex(user => user.clientID === clientID);
    if (index !== -1){
        const identifier = onlineUsers[index].identifier;

        const sql = "UPDATE `users` SET lastOnline = ? WHERE identifier = ?";
        const data = [Date.now() / 1000, identifier];
        connection.query(sql, data, function (err, result) {
            if (err) console.log(err);
        });
        onlineUsers.splice(index, 1);
    }
}

function CloseChatForUser(clientID){
    const chat_name = usersChats[clientID];
    const arr = chatsActiveUsers[chat_name];
    if (arr){
        const index = arr.indexOf(clientID);
        if (index !== -1)
            chatsActiveUsers[chat_name].splice(index, 1);
    }
    usersChats[clientID] = undefined;
}
function OpenChatForUser(chat_name, clientID){
    if (chat_name !== "null"){
        if (chatsActiveUsers[chat_name])
            chatsActiveUsers[chat_name].push(clientID);
        else
            chatsActiveUsers[chat_name] = [clientID];
        usersChats[clientID] = chat_name;
    }
}

async function SendMessage(connection, ws, message){
    await Utils.GetUserFromDB(connection, message.sender).then(sender => {
        if (sender){
            Utils.GetChatMembers(connection, message.chat).then(members => {
                if (members){
                    const chat_name = message.chat;
                    const in_chat_users = chatsActiveUsers[chat_name];
                    const online_users = [];
                    const offline_users = [];

                    const all_online_users = onlineUsers;

                    members.forEach(member => {
                        const index = all_online_users.findIndex(user => user.identifier === member.identifier);
                        if (index !== -1 && in_chat_users){
                            if (in_chat_users.findIndex(user => user === all_online_users[index].clientID) === -1)
                                online_users.push(all_online_users[index]);
                        }
                        else{
                            offline_users.push(member);
                        }
                    });

                    message.time = Math.round(Date.now()/1000);
                    message.value = message.value.replace(/(<([^>]+)>)/gi, '');
                    message.avatar = sender.avatar;
                    message.username = sender.username;

                    const sql = 'INSERT INTO `' + chat_name + '` (sender, dataType, value, reply, time, isRead, reaction) VALUES (?, ?, ?, ?, ?, ?, ?)';
                    const data = [message.sender, message.dataType, message.value, message.reply, message.time, message.isRead, ""];
                    connection.query(sql, data, function (err, results){
                        if(err) console.log(err);
                        else{
                            message.id = results.insertId;
                            if (in_chat_users){
                                in_chat_users.forEach(user => {
                                    message.clientID = user;
                                    ws.sendUTF(JSON.stringify(message));
                                });
                            }
                            online_users.forEach(user => {
                                if (message.sender !== user.identifier){
                                    let msg = {
                                        chat: message.chat,
                                        event: "Notification",
                                        clientID: user.clientID
                                    };
                                    ws.sendUTF(JSON.stringify(msg));
                                    Utils.SendMessageForNotInChatUser(connection, ws, user.identifier, message);
                                }
                            });
                            offline_users.forEach(user => {
                                Utils.SendMessageForNotInChatUser(connection, ws, user.identifier, message);
                            });
                        }
                    });
                    const updChatSql = 'UPDATE `chats` SET lastMessage = ?, lastUpdate = ? WHERE identifier = ?';
                    const updChatData = [JSON.stringify(message), message.time, chat_name];
                    connection.query(updChatSql, updChatData, function (err, result){
                        if (err) console.log(err);
                    });
                }
            });
        }
    });
}
async function DeleteMessage(connection, ws, identifier, password, id, chat_name){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            HasPermissionForMessage(connection, identifier, id, chat_name).then(has => {
                if (has){
                    const in_chat_users = chatsActiveUsers[chat_name];
                    const reply = {
                        chat: chat_name,
                        messageId: id,
                        event: "DeleteMessageForUsers"
                    };
                    if (in_chat_users){
                        in_chat_users.forEach(user => {
                            reply.clientID = user;
                            ws.sendUTF(JSON.stringify(reply));
                        });
                    }
        
                    const sql = "DELETE FROM `" + chat_name + "` WHERE id = ?";
                    const data = [id];
                    connection.query(sql, data, function (err, result){
                        if (err) console.log(err);
                    });
                }
            });
        }
    });
}
async function HasPermissionForMessage(connection, identifier, id, chat_name){
    const sql = "SELECT * FROM `" + chat_name + "` WHERE id = ?";
    const data = [id];
    return new Promise((resolve, reject) => {
        connection.query(sql, data, function (err, result){
            if (err) console.log(err);
            else{
                const message = result[0];
                resolve(message.sender === identifier);
            }
        });
    });
}
async function EditMessage(connection, ws, identifier, password, value, id, chat_name, ){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            HasPermissionForMessage(connection, identifier, id, chat_name).then(has => {
                if (has){
                    value = value.replace(/(<([^>]+)>)/gi, '');
                    const in_chat_users = chatsActiveUsers[chat_name];
                    const reply = {
                        chat: chat_name,
                        messageId: id,
                        value: value,
                        event: "EditMessageForUsers"
                    };
                    if (in_chat_users){
                        in_chat_users.forEach(user => {
                            reply.clientID = user;
                            ws.sendUTF(JSON.stringify(reply));
                        });
                    }
                    const sql = "UPDATE `" + chat_name + "` SET value = ? WHERE id = ?";
                    const data = [value, id];

                    connection.query(sql, data, function (err, result){
                        if (err) console.log(err);
                    });
                }
            });
        }
    });
}
function ReadMessage(connection, ws, id, chat_name){
    const in_chat_users = chatsActiveUsers[chat_name];
        const forUsers = {
            chat: chat_name,
            id: id,
            event: "MessageIsRead"
        };
        if (in_chat_users){
            in_chat_users.forEach(user => {
                forUsers.clientID = user;
                ws.sendUTF(JSON.stringify(forUsers));
            });
        }
        const sql = "UPDATE `" + chat_name + "` SET isRead = 1 WHERE id = ?";
        const data = [id];
        connection.query(sql, data, function (err, result){
            if (err) console.log(err);
        });
}
function Typing(ws, message){
    const in_chat_users = chatsActiveUsers[message.chat];
    if (in_chat_users){
        in_chat_users.forEach(user => {
            message.clientID = user;
            ws.sendUTF(JSON.stringify(message));
        });
    }
}
function AddReaction(connection, ws, table_name, id, sender, type){
    const getReaction = "SELECT reaction FROM `" + table_name + "` WHERE id = ?";
    connection.query(getReaction, [id], function (err, result) {
        if (err) console.log(err);
        else{
            let reactions;
            if (result[0].reaction === "")
                reactions = [];
            else
                reactions = JSON.parse(result[0].reaction);
            let newReaction = {
                sender: sender,
                type: type
            };

            let rIndex = reactions.findIndex(r => r.sender === sender);
            if (rIndex === -1)
                reactions.push(newReaction);
            else
                reactions[rIndex] = newReaction;

            const sql = "UPDATE `" + table_name + "` SET reaction = ? WHERE id = ?";
            const data = [JSON.stringify(reactions), id];

            connection.query(sql, data, function (err, result) {
                if (err) console.log(err);
            });

            const reactionForUsers = {
                chat: table_name,
                messageId: id,
                reactions: reactions,
                event: "ReactionForUsers"
            };
            const in_chat_users = chatsActiveUsers[table_name];
            if (in_chat_users){
                in_chat_users.forEach(user => {
                    reactionForUsers.clientID = user;
                    ws.sendUTF(JSON.stringify(reactionForUsers));
                });
            }
        }
    });
}
function RemoveReaction(connection, ws, table_name, id, sender){
    const getReaction = "SELECT reaction FROM `" + table_name + "` WHERE id = " + id + "";
    connection.query(getReaction, function (err, result) {
        if (err) Utils.error(err);
        else{
            let reactions;
            if (result[0].reaction === "")
                reactions = [];
            else
                reactions = JSON.parse(result[0].reaction);
            
            let rIndex = reactions.findIndex(r => r.sender === sender);
            if (rIndex !== -1)
                reactions.splice(rIndex, 1);

            const sql = "UPDATE `" + table_name + "` SET reaction = ? WHERE id = ?";
            const data = [JSON.stringify(reactions), id];

            connection.query(sql, data, function (err, result) {
                if (err) console.log(err);
            });

            const reactionForUsers = {
                chat: table_name,
                messageId: id,
                reactions: reactions,
                event: "ReactionForUsers"
            };
            const in_chat_users = chatsActiveUsers[table_name];
            if (in_chat_users){
                in_chat_users.forEach(user => {
                    reactionForUsers.clientID = user;
                    ws.sendUTF(JSON.stringify(reactionForUsers));
                });
            }
        }
    });
}