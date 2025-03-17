require("dotenv").config();
const WebSocketClient = require('websocket').client;
const Utils = require("./Utils");
const rsa = require("node-rsa");
const fs = require("fs");

const api_address = process.env.API_ADDRESS;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


let clientsKeys = {};

const client = new WebSocketClient();

client.on("connect", (connection) => {
    const registerService = {
        event: "RegisterService",
        serviceName: "CryptoService",
        requests: []
    };
    connection.sendUTF(JSON.stringify(registerService));

    connection.on("message", async (message) => {
        message = JSON.parse(message.utf8Data);
        let request_user = GetRequestUser(message);
        switch(message.event){
            case "GeneraeteKeys":
                GenerateKeysPair(connection, message.clientID);
                break;
            case "RemoveKeys":
                RemoveKeys(message.clientID);
                break;
            default:
                console.log(message);
        }
    });
});

client.connect(api_address, 'echo-protocol');


function GetRequestUser(message) {
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
    return request_user;
}

function GenerateKeysPair(ws, clientID){
    const key = new rsa().generateKeyPair();

    const publicKey = key.exportKey("public");
    const privateKey = key.exportKey("private");

    clientsKeys[clientID] = {
        publicKey: publicKey,
        privateKey: privateKey
    }
    const request = {
        event: "ReturnPublicKey",
        clientID: clientID,
        publicKey: publicKey
    }
    ws.sendUTF(JSON.stringify(request));
}

function RemoveKeys(clientID) {
    clientsKeys[clientID] = undefined;
}
