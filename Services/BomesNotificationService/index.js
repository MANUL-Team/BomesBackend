require("dotenv").config();
const WebSocketClient = require('websocket').client;
const mysql = require("mysql2");
const Utils = require("./Utils");
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

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
        serviceName: "NotificationsService",
        requests: ["SendPushNotification"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", async (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "SendPushNotification":
                await SendPushNotification(con, message.title, message.body, message.userId, message.imageUrl);
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
async function SendPushNotification(connection, title, body, userId, imageUrl){
    await Utils.GetUserFromDB(connection, userId).then(user => {
        if (user.tokens) {
            for (let i = 0; i < user.tokens.length; i++) {
                try {
                    const token = user.tokens[i];
                    if (token === null || token === undefined || token.length < 2) {
                        console.log('this is an invalid token');
                    }
                    let message;
                    if (imageUrl !== "") {
                        message = {
                            notification: {
                                title,
                                body,
                                imageUrl,
                            },
                            android: {
                                notification: {
                                    channel_id: 'MESSAGE_CHANNEL',
                                    icon: 'message_icon',
                                    imageUrl: imageUrl,
                                },
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: 'chime.caf',
                                    },
                                },
                            },
                            token,
                        };
                    } else {
                        message = {
                            notification: {
                                title,
                                body,
                            },
                            android: {
                                notification: {
                                    channel_id: 'MESSAGE_CHANNEL',
                                    icon: 'message_icon',
                                },
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: 'chime.caf',
                                    },
                                },
                            },
                            token,
                        };
                    }
                    admin.messaging().send(message).catch(err => {
                        user.tokens.splice(i, 1);

                        const sql = "UPDATE `users` SET tokens = ? WHERE identifier = ?";
                        const data = [JSON.stringify(user.tokens), user.identifier];

                        connection.query(sql, data, function (err, result) {
                            if (err) console.log(err);
                        });
                    });
                }
                catch{
                    const token = user.tokens[i];
                    user.tokens.splice(i, 1);

                    const sql = "UPDATE `users` SET tokens = ? WHERE identifier = ?";
                    const data = [JSON.stringify(user.tokens), user.identifier];

                    connection.query(sql, data, function (err, result) {
                        if (err) console.log(err);
                    });
                }
            }
        }
    });
}