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
function SendMessageForNotInChatUser(connection, ws, member, message){
    const updNotReadSql = "UPDATE `" + member + "-chats" + "` SET notRead = notRead + 1 WHERE table_name = ?";
    const data = [message.chat];
    connection.query(updNotReadSql, data, function (err, result) {
        if (err) console.log(err);
    });
    
    SendNotification(ws, member, message);
}

function SendNotification(ws, indentifier, message){
    const pushRequest = {
        event: "SendPushNotification",
        service: "NotificationsService",
        title: message.username,
        body: message.value,
        userId: indentifier,
        imageUrl: ""
    };
    if (message.dataType === "image"){
        pushRequest.body = "Изображение";
        pushRequest.imageUrl = `https://bomes.ru/${message.value}`;
    }
    else if (message.dataType === "sticker"){
        pushRequest.body = "Стикер";
        pushRequest.imageUrl = `https://bomes.ru/${message.value}`;
    }
    else if (message.dataType !== "text"){
        pushRequest.body = "Вложение";
        pushRequest.imageUrl = "";
    }
    ws.sendUTF(JSON.stringify(pushRequest));
}

module.exports = {
    GetUserFromDB,
    GetChatMembers,
    SendMessageForNotInChatUser
}