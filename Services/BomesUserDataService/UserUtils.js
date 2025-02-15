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
                    console.log("ERROR! Identifier: " + identifier);
                }
            }
        });
    });
}
async function GetUserChatsNames(connection, identifier) {
    return new Promise((resolve, reject) => {
        const table_name = identifier + "-chats";
        const sql = "SELECT table_name, chat_name, notRead FROM `" + table_name + "`";
        connection.query(sql, async function (err, result) {
            if (err) console.log(err);
            let table_names = [];
            let chat_names = [];
            let notReads = [];
            result.forEach(r => {
                table_names.push(r.table_name);
                chat_names.push(r.chat_name);
                notReads.push(r.notRead);
            });
            resolve([table_names, chat_names, notReads]);
        });
    });
}
async function GetFullChatsFromSql(connection, table_names, chat_names, notReads){
    const sql = CreateSQLQueryForGetChats(table_names);
    return new Promise((resolve, reject) => {
        if (table_names.length === 0){
            resolve([]);
            return;
        }
        connection.query(sql, async function(err, result) {
            if (err) console.log(err);
            let promises = [];
            result.forEach(r => {
                let index = table_names.indexOf(r.identifier);
                if (r.isLocalChat === 1){
                    promises.push(new Promise((resolve, reject) => {
                        GetUserFromDB(connection, chat_names[index]).then(user => {
                            let has_last_update = r.lastUpdate !== null;
                            r.chat_name = user.username;
                            r.table_name = r.identifier;
                            r.avatar = user.avatar;
                            r.notRead = notReads[index];
                            r.lastOnline = user.lastOnline;
                            r.user_identifier = user.identifier;
                            if (r.lastMessage === ""){
                                r.lastMessage = "Сообщений пока нет...";
                                if (!has_last_update)
                                    r.lastUpdate = 0;
                            }
                            else{
                                let msg = JSON.parse(r.lastMessage);
                                if (!has_last_update)
                                    r.lastUpdate = msg.time;
                                if (msg.dataType === "text")
                                    r.lastMessage = msg.username + ": " + msg.value;
                                else if (msg.dataType === "image")
                                    r.lastMessage = msg.username + ": Изображение";
                                else if (msg.dataType === "sticker")
                                    r.lastMessage = msg.username + ": Стикер";
                                else if (msg.dataType === "video")
                                    r.lastMessage = msg.username + ": Видео";
                                else
                                    r.lastMessage = msg.username + ": Вложение";
                            }

                            if (!has_last_update){
                                const add_lastUpdate = "UPDATE `chats` SET lastUpdate = ? WHERE identifier = ?";
                                connection.query(add_lastUpdate, [r.lastUpdate, r.identifier], function(err, result){
                                    if (err) error(err);
                                });
                            }
                            resolve(r);
                        });
                    }));
                }
                else{
                    r.chat_name = r.chatName;
                    r.table_name = r.identifier;
                    r.notRead = notReads[index];
                    if (!r.avatar) r.avatar = "media/icon.png";
                    if (r.lastMessage === ""){
                         r.lastMessage = "Сообщений пока нет...";
                         r.lastUpdate = 0;
                    }
                    else{
                        let msg = JSON.parse(r.lastMessage);
                        r.lastUpdate = msg.time;
                        if (msg.dataType === "text")
                            r.lastMessage = msg.username + ": " + msg.value;
                        else
                            r.lastMessage = msg.username + ": Вложение";
                    }
                }
            });
            Promise.all(promises).then((values) => {
                resolve(result);
            });
        });
    });
}
function CreateSQLQueryForGetChats(names){
    let sql = "SELECT * FROM `chats` WHERE identifier in (";
    names.forEach(name => {
        sql += "'" + name + "', ";
    });
    sql = sql.slice(0, -2);
    sql += ") order by lastUpdate desc;";
    return sql;
}
function matFilter(text){
    text = text.toLowerCase()
        .replaceAll("x", "х")
        .replaceAll("y", "у")
        .replaceAll("e", "е")
        .replaceAll("p", "р")
        .replaceAll("c", "с")
        .replaceAll("k", "к");
    let mats = [
        "хуй",
        "бля",
        "пизд",
        "еба",
        "ёб",
        "ебн",
        "хуе",
        "хуи",
        "хуя",
        "трах",
        "сука"
    ];
    let contains = false;
    mats.forEach(mat => {
        if (text.includes(mat)){
            contains = true;
        }
    });
    return contains;
}

module.exports = {
    GetUserFromDB,
    GetUserChatsNames,
    GetFullChatsFromSql,
    CreateSQLQueryForGetChats,
    matFilter
}
