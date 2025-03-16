var rsa = require("node-rsa");
var fs = require("fs");

var publicKey = new rsa();
var privateKey = new rsa();

var public = fs.readFileSync("./Keys/public.pem","utf-8");
var private = fs.readFileSync("./Keys/private.pem","utf-8");

publicKey.importKey(public);
privateKey.importKey(private);


// ПО ПРИВАТНОМУ КЛЮЧУ ЗАШИФРОВЫВАЕМ И ДОБАВЛЯЕМ ЛИШНЮЮ ИНФОРМАЦИЮ
function EncryptMessage(mail) {
    const saltFirst = "CA75wevrk234lcqwdV"
    const saltSecond = "CA75wevrk234lcqwdV"
    
    const encrypted = privateKey.encryptPrivate(saltFirst+mail+saltSecond, "base64");
    return encrypted;
}

// ПО ПУБЛИЧНОМУ КЛЮЧУ РАСШИФРОВЫВАЕМ И УБИРАЕМ ЛИШНЕЕ
function DecryptMessage(licence){
    const decrypted = publicKey.decryptPublic(licence,"utf8");
    return decrypted.slice([18],[-18]);
}
    

let encrypted = EncryptMessage("Test message");
console.log("Зашифрованное сообщение: " + encrypted);
console.log("Расшифрованное сообщение: " + DecryptMessage(encrypted));
