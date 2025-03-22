require("dotenv").config();
const WebSocketClient = require('websocket').client;

const api_address = process.env.API_ADDRESS;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new WebSocketClient();


let calls = {};

client.on("connect", (connection) => {
    const registerService = {
        event: "RegisterService",
        serviceName: "CallingService",
        requests: ["CreateCall", "ConnectCall", "RemoveCall", "DisconnectCall"]
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", (message) => {
        message = JSON.parse(message.utf8Data);
        switch(message.event){
            case "CreateCall":
                CreateCall(connection, message.clientID, message.owner);
                break;
            case "ConnectCall":
                ConnectCall(connection, message.clientID, message.callID, message.identifier);
                break;
            case "RemoveCall":
                break;
            case "DisconnectCall":
                break;
            default:
                console.log(message);
        }
    });
});

client.on("connectFailed", (errorDescription) => {
    console.log("FAIL TO CONNECT!");
    console.log(errorDescription);
});

client.connect(api_address, "echo-protocol");

function generateRandomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function CreateCall(ws, clientID, owner){
    let callId = generateRandomString(20);
    let call = {
        callId,
        users: [owner]
    }
    calls[callId] = call;
    let request = {
        event: "CallCreated",
        callId: callId,
        clientID: clientID
    }
    ws.sendUTF(JSON.stringify(request));
}

function ConnectCall(ws, clientID, callID, identifier) {
    if (calls[callID]){
        let request = {
            event: "ReturnCallData",
            callId: callID,
            clientID: clientID,
            users: calls[callID].users
        }
        ws.sendUTF(JSON.stringify(request));
        calls[callID].users.push(identifier);
    }
}