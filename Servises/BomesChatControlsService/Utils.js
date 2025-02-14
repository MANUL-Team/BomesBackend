const hashingMD5 = require("crypto-js/md5.js")

function CreateGroupChatMembersTable(database_connection, table_name, users_to_add, owner){
    let membersTable = table_name + "-members";
    const createChatMembersSql = "CREATE TABLE `" + membersTable + "` (id integer NOT NULL PRIMARY KEY AUTO_INCREMENT, identifier text, role text)";
    return new Promise(((resolve, reject) => {
        database_connection.query(createChatMembersSql, function (err, result) {
            if (err) console.log(err);
            else {
                const addUsersSql = "INSERT INTO `"+membersTable+"` (identifier, role) VALUES (?, ?)";
                users_to_add.forEach(userToAdd => {
                    let data = [userToAdd];
                    if (userToAdd === owner) data.push("owner");
                    else data.push("member");
                    database_connection.query(addUsersSql, data, function (err, result) {
                        if (err) console.log(err);
                    })
                });
                resolve(true);
            }
        });
    }));
}

function CreateChatMembersTable(database_connection, table_name, users_to_add){
    let membersTable = table_name + "-members";
    const createChatMembersSql = "CREATE TABLE `" + membersTable + "` (id integer NOT NULL PRIMARY KEY AUTO_INCREMENT, identifier text)";
    return new Promise(((resolve, reject) => {
        database_connection.query(createChatMembersSql, function (err, result) {
            if (err) console.log(err);
            else {
                const addUsersSql = "INSERT INTO `"+membersTable+"` (identifier) VALUES (?)";
                users_to_add.forEach(userToAdd => {
                    database_connection.query(addUsersSql, [userToAdd], function (err, result) {
                        if (err) console.log(err);
                    })
                });
                resolve(true);
            }
        });
    }));
}

function AddGroupChatIntoChatsTable(database_connection, table_name, chatName, is_local, avatar){
    const mainAddingChatSql = "INSERT INTO `chats` (identifier, chatName, isLocalChat, lastMessage, avatar) VALUES (?, ?, ?, ?, ?)";
    const mainData = [table_name, chatName, is_local, "", avatar];
    return new Promise(((resolve, reject) => {
        database_connection.query(mainAddingChatSql, mainData, function (err, result) {
            if (err){
                reject(err);
                console.log(err);
            } 
            else resolve(true);
        });
    }));
}

function AddChatIntoChatsTable(database_connection, table_name, users_to_add, is_local){
    const mainAddingChatSql = "INSERT INTO `chats` (identifier, chatName, isLocalChat, lastMessage) VALUES (?, ?, ?, ?)";
    const mainData = [table_name, JSON.stringify(users_to_add), is_local, ""];
    return new Promise(((resolve, reject) => {
        database_connection.query(mainAddingChatSql, mainData, function (err, result) {
            if (err) reject(err);
            else resolve(true);
        });
    }));
}

function AddChatIntoUserPrivateTable(database_connection, table_name, whose_table, chat_name){
    const chatsTable = whose_table + "-chats";
    const addToChatSql = "INSERT INTO `" + chatsTable + "` (table_name, chat_name, notRead) VALUES (?, ?, ?)";
    const addData = [table_name, chat_name, 0];
    return new Promise(((resolve, reject) => {
        database_connection.query(addToChatSql, addData, function (err, result) {
            if (err) reject(err);
            else resolve(true);
        });
    }));
}

function CreateChatMainTable(database_connection, table_name){
    const sql = "CREATE TABLE `" + table_name + "` (id integer NOT NULL PRIMARY KEY AUTO_INCREMENT, sender text, dataType text, value text, reply text, time integer, isRead integer, reaction text)";
    return new Promise(((resolve, reject) => {
        database_connection.query(sql, function (err, result) {
            if (err) reject(err);
            else resolve(true);
        });
    }));
}

function SendChatCreated(ws, table_name, chat_name, is_local, clientID){
    const reply = {
        table_name: table_name,
        chat_name: chat_name,
        isLocalChat: is_local,
        event: "ChatCreated",
        clientID: clientID
    }
    ws.sendUTF(JSON.stringify(reply));
}

function GetTableName(users_to_add, is_local){
    let table_name;
    if (is_local) table_name = "";
    else table_name = String(Date.now());
    for(let i = 0; i < users_to_add.length; i++){
        table_name += "-" + users_to_add[i];
    }
    table_name = hashingMD5(table_name).toString();
    return table_name;
}

function ChatAlreadyCreated(database_connection, database_name, table_name){
    const checkChatSql = "SELECT EXISTS (" +
        "  SELECT *" +
        "  FROM INFORMATION_SCHEMA.TABLES " +
        "  WHERE TABLE_SCHEMA = ?" +
        "  AND TABLE_NAME = ?" +
        ") AS table_exists;";
    let data = [database_name, table_name];

    return new Promise(((resolve, reject) => {
        database_connection.query(checkChatSql, data, function (err, result) {
            if (err) reject(err);
            else resolve(result[0].table_exists !== 0);
        });
    }));
}
function GetUserFromDB(connection, identifier){
    const sql = "SELECT * FROM `users` WHERE identifier = ?";
    const data = [identifier];

    return new Promise((resolve, reject) => {
        connection.query(sql, data, function (err, result) {
            if (err) reject(err);
            else {
                const item = result[0];
                if (item) {
                    const user = {
                        identifier: item.identifier,
                        email: item.email,
                        password: item.password,
                        username: item.username,
                        avatar: item.avatar,
                        description: item.description,
                        lastOnline: item.lastOnline,
                        tokens: JSON.parse(item.tokens),
                        friends: JSON.parse(item.friends),
                    }
                    resolve(user);
                }
                else{
                    error("ERROR! Identifier: " + identifier);
                }
            }
        });
    });
}

module.exports = {
    CreateGroupChatMembersTable,
    CreateChatMembersTable,
    AddGroupChatIntoChatsTable,
    AddChatIntoChatsTable,
    AddChatIntoUserPrivateTable,
    CreateChatMainTable,
    SendChatCreated,
    GetTableName,
    ChatAlreadyCreated,
    GetUserFromDB
}