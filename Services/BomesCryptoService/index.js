require("dotenv").config();
const WebSocketClient = require('websocket').client;
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
            case "EncryptMessage":
                EncryptMessage(connection, message.clientID, message.data);
                break;
            case "DecryptMessage":
                DecryptMessage(message.clientID, message.data);
                break;
            default:
                console.log(message);
        }
    });
});

// client.connect(api_address, 'echo-protocol');


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

function EncryptMessage(ws, clientID, message) {
    if (message.event === "SendMessage") {
        const privateKey = new rsa().importKey(clientsKeys[clientID].privateKey);
        message.clientID = undefined;
        const saltFirst = "CA75wevrk234lcqwdV"
        const saltSecond = "CA75wevrk234lcqwdV"
        
        const encrypted = privateKey.encryptPrivate(saltFirst + JSON.stringify(message) + saltSecond, "base64");
        const request = {
            event: "ReturnEncryptedMessage",
            data: encrypted,
            clientID: clientID
        }
        ws.sendUTF(JSON.stringify(request));
    }
}

function DecryptMessage(clientID, message){
    const publicKey = new rsa().importKey(clientsKeys[clientID].publicKey);
    const decrypted = publicKey.decryptPublic(message, "utf8").slice([18],[-18]);
    const request = {
        event: "DecryptedMessage",
        data: decrypted
    }
    ws.sendUTF(JSON.stringify(request));
}
