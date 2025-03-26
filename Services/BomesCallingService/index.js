require("dotenv").config();
const WebSocketClient = require('websocket').client;

const api_address = process.env.API_ADDRESS;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new WebSocketClient();


let calls = {};
let clients = {};

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
                CreateCall(connection, message.clientID, message.identifier);
                break;
            case "ConnectCall":
                ConnectCall(connection, message.clientID, message.callID, message.identifier, message.username, message.avatar);
                break;
            case "RemoveCall":
                RemoveCall(message.clientID);
                break;
            case "DisconnectCall":
                DisconnectCall(message.clientID);
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
    let callID = generateRandomString(20);
    console.log("Creating call: " + callID + ", owner: " + owner);
    let call = {
        callID,
        users: [{identifier: owner, clientID}],
        owner
    }
    calls[callID] = call;
    clients[clientID] = {
        identifier: owner,
        callID
    };
    let request = {
        event: "CallCreated",
        callID: callID,
        clientID: clientID
    }
    ws.sendUTF(JSON.stringify(request));
}

function ConnectCall(ws, clientID, callID, identifier, username, avatar) {
    if (calls[callID]){
        console.log("Connecting to call " + callID + ", user: " + identifier);
        const connectingUser = {identifier, callID, clientID, username, avatar};

        calls[callID].users.forEach(client => {
            const message = {
                event: "CallFromOther",
                user: connectingUser,
                clientID: client.clientID
            };
            ws.sendUTF(JSON.stringify(message));
        });

        clients[clientID] = connectingUser;
        let request = {
            event: "ReturnCallData",
            callID: callID,
            clientID: clientID,
            users: calls[callID].users
        }
        ws.sendUTF(JSON.stringify(request));
        calls[callID].users.push(connectingUser);
    }
}

function RemoveCall(clientID) {
    const client = clients[clientID];
    if (client && client.callID) {
        let call = calls[client.callID];
        console.log("Removing call: " + call.callID);
        if (call && call.owner === client.identifier) {
            for(let i = 0; i < call.users.length; i++){
                clients[call.users[i].clientID].callID = undefined;
            }
            calls[call.callID] = undefined;
        }
    }
}

function DisconnectCall(clientID){
    const client = clients[clientID];
    if (client && client.callID){
        const call = calls[client.callID];
        if (call) {
            console.log("Disconnecting from call: " + call.callID + ", user: " + client.identifier);
            const index = call.users.findIndex(u => u.clientID === clientID);
            if (index !== -1){
                call.users.splice(index, 1);
            }
            if (call.users.length === 0){
                setTimeout(() => {
                    if (call.users.length === 0) {
                        console.log("Removing call: " + call.callID);
                        calls[call.callID] = undefined;
                    }
                }, 3000);
            }
            client.callID = undefined;
        }
    }
}

