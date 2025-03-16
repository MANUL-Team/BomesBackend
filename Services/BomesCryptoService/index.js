var rsa = require("node-rsa");
var fs = require("fs");
// ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ КЛЮЧЕЙ: ПУБЛИЧНОГО И ПРИВАТНОГО
function GeneratePair(){
    var key = new rsa().generateKeyPair();

    var publicKey = key.exportKey("public");
    var privateKey = key.exportKey("private");

    fs.openSync("./Keys/public.pem","w");
    fs.writeFileSync("./Keys/public.pem",publicKey,"utf-8");

    fs.openSync("./Keys/private.pem","w");
    fs.writeFileSync("./Keys/private.pem",privateKey,"utf-8");
}

GeneratePair();
