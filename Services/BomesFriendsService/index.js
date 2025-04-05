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

let reconnectionInterval

client.on("connect", (connection) => {
    if (reconnectionInterval) {
        clearInterval(reconnectionInterval)
        reconnectionInterval = undefined
    }
    const registerService = {
        event: "RegisterService",
        serviceName: "FriendsService",
        requests: ["AddFriend", "RemoveFriend", "GetFriends", "GetIncomingFriends"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
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
            case "AddFriend":
                AddFriend(con, connection, request_user.identifier, request_user.password, message.identifier);
                break;
            case "RemoveFriend":
                RemoveFriend(con, connection, request_user.identifier, request_user.password, message.identifier);
                break;
            case "GetFriends":
                GetFriends(con, connection, request_user.identifier, request_user.password, message.identifier, message.clientID);
                break;
            case "GetIncomingFriends":
                GetIncomingFriends(con, connection, request_user.identifier, request_user.password, message.clientID);
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

async function AddFriend(connection, ws, request_identifier, request_password, identifier){
    await Utils.GetUserFromDB(connection, request_identifier).then(me => {
        if (me.password === request_password){
            Utils.GetUserFromDB(connection, identifier).then(friend => {
                const sql = "UPDATE `users` SET friends = ? WHERE identifier = ?";
                let dataMy;
                let dataFriend;

                if (me.friends === null){
                    me.friends = {
                        sentRequests: [],
                        incomingRequests: [],
                        friends: []
                    };
                }
                if (friend.friends === null){
                    friend.friends = {
                        sentRequests: [],
                        incomingRequests: [],
                        friends: []
                    };
                }

                if (!me.friends.sentRequests.includes(friend.identifier) &&
                    !me.friends.friends.includes(friend.identifier) &&
                    !me.friends.incomingRequests.includes(friend.identifier))
                {
                    me.friends.sentRequests.push(friend.identifier);
                    friend.friends.incomingRequests.push(me.identifier);
                    const pushRequest = {
                        event: "SendPushNotification",
                        service: "NotificationsService",
                        title: "Новый друг!",
                        body: me.username + " отправил(а) вам заявку в друзья!",
                        userId: friend.identifier,
                        imageUrl: ""
                    };
                    ws.sendUTF(JSON.stringify(pushRequest));
                }
                else if (me.friends.incomingRequests.includes(friend.identifier)){
                    let myInd = me.friends.incomingRequests.indexOf(friend.identifier);
                    let friendInd = friend.friends.sentRequests.indexOf(me.identifier);
                    me.friends.incomingRequests.splice(myInd, 1);
                    friend.friends.sentRequests.splice(friendInd, 1);
                    me.friends.friends.push(friend.identifier);
                    friend.friends.friends.push(me.identifier);
                    const pushRequest = {
                        event: "SendPushNotification",
                        service: "NotificationsService",
                        title: "Ваша заявка принята!",
                        body: me.username + " принял(а) вашу заявку в друзья!",
                        userId: friend.identifier,
                        imageUrl: ""
                    };
                    ws.sendUTF(JSON.stringify(pushRequest));
                    const sql = `UPDATE \`users\` SET popularity = popularity + 5 WHERE identifier = ?`;
                    const data = [friend.identifier];
                    connection.query(sql, data, function (err, result) {
                        if (err) console.log(err);
                    });
                }
                dataMy = [JSON.stringify(me.friends), me.identifier];
                dataFriend = [JSON.stringify(friend.friends), friend.identifier];

                connection.query(sql, dataMy, function (err, result) {
                    if (err) console.log(err);
                });
                connection.query(sql, dataFriend, function (err, result) {
                    if (err) console.log(err);
                });
            });
        }
    });
}
async function RemoveFriend(connection, ws, request_identifier, request_password, identifier) {
    await Utils.GetUserFromDB(connection, request_identifier).then(me => {
        if (me.password === request_password){
            Utils.GetUserFromDB(connection, identifier).then(friend => {
                const sql = "UPDATE `users` SET friends = ? WHERE identifier = ?";
                let dataMy;
                let dataFriend;

                if (me.friends === null){
                    me.friends = {
                        sentRequests: [],
                        incomingRequests: [],
                        friends: []
                    };
                }
                if (friend.friends === null){
                    friend.friends = {
                        sentRequests: [],
                        incomingRequests: [],
                        friends: []
                    };
                }

                if (me.friends.sentRequests.includes(friend.identifier)){
                    me.friends.sentRequests.splice(me.friends.sentRequests.indexOf(friend.identifier), 1);
                    friend.friends.incomingRequests.splice(friend.friends.incomingRequests.indexOf(me.identifier), 1);
                    const pushRequest = {
                        event: "SendPushNotification",
                        service: "NotificationsService",
                        title: "Вас удалили из друзей",
                        body: me.username + " отменил(а) заявку в друзья!",
                        userId: friend.identifier,
                        imageUrl: ""
                    };
                    ws.sendUTF(JSON.stringify(pushRequest));
                }
                else if (me.friends.friends.includes(friend.identifier)){

                    me.friends.friends.splice(me.friends.friends.indexOf(friend.identifier), 1);
                    friend.friends.friends.splice(friend.friends.friends.indexOf(me.identifier), 1);
                    me.friends.incomingRequests.push(friend.identifier);
                    friend.friends.sentRequests.push(me.identifier);
                    const pushRequest = {
                        event: "SendPushNotification",
                        service: "NotificationsService",
                        title: "Вас удалили из друзей",
                        body: me.username + " удалил(а) вас из друзей",
                        userId: friend.identifier,
                        imageUrl: ""
                    };
                    ws.sendUTF(JSON.stringify(pushRequest));
                    const sql = `UPDATE \`users\` SET popularity = popularity - 5 WHERE identifier = ?`;
                    const data = [friend.identifier];
                    connection.query(sql, data, function (err, result) {
                        if (err) console.log(err);
                    });
                }
                dataMy = [JSON.stringify(me.friends), me.identifier];
                dataFriend = [JSON.stringify(friend.friends), friend.identifier];

                connection.query(sql, dataMy, function (err, result) {
                    if (err) console.log(err);
                });
                connection.query(sql, dataFriend, function (err, result) {
                    if (err) console.log(err);
                });
            });
        }
    });
}
async function GetFriends(connection, ws, request_identifier, request_password, identifier, clientID){
    await Utils.GetUserFromDB(connection, request_identifier).then(me => {
        if (me.password === request_password){
            Utils.GetUserFromDB(connection, identifier).then(user => {
                let promises = [];
                let friends = [];
                if (user.friends && user.friends.friends){
                    for(let i = 0; i < user.friends.friends.length; i++){
                        promises.push(new Promise((resolve, reject) => {
                            Utils.GetUserFromDB(connection, user.friends.friends[i]).then(friend => {
                                let returningUser = {
                                    username: friend.username,
                                    avatar: friend.avatar,
                                    identifier: friend.identifier,
                                    friendsCount: friend.friends.friends.length
                                };
                                friends.push(returningUser);
                                resolve(returningUser);
                            });
                        }));
                    }
                    Promise.all(promises).then(values => {
                        let reply = {
                            event: "ReturnFriends",
                            users: friends,
                            clientID: clientID
                        };
                        ws.sendUTF(JSON.stringify(reply));
                    });
                }
            });
        }
    });
}
async function GetIncomingFriends(connection, ws, identifier, password, clientID){
    await Utils.GetUserFromDB(connection, identifier).then(user => {
        if (user.password === password){
            if (!user.friends){
                user.friends = {
                    sentRequests: [],
                    incomingRequests: [],
                    friends: []
                };
            }
            const request = {
                clientID: clientID,
                incomingRequests: user.friends.incomingRequests,
                event: "ReturnIncomingRequests",
            };
            ws.sendUTF(JSON.stringify(request));
        }
        else{
            const request = {
                event: "Error",
                data: "Wrong password!",
                clientID: clientID
            };
            ws.sendUTF(JSON.stringify(request));
        }
    });
}
