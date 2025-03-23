function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

function generateKeys(key_length){
    public_key = "------Bomes Public Key Begin------\n";
    private_key = "------Bomes Private Key Begin------\n";
    let trashSizeCode = getRandomInt(8, 33);
    public_key += String.fromCharCode(trashSizeCode + 80);
    private_key += String.fromCharCode((trashSizeCode + 20) * 5);
    for(let i = 0; i < key_length; i++){
        let code = getRandomInt(5, 15);
        public_key += String.fromCharCode(code + 80);
        private_key += String.fromCharCode((code + 20) * 5);
    }
    public_key += "\n------Bomes Public Key End------";
    private_key += "\n------Bomes Private Key End------";
    return {
        public_key,
        private_key
    };
}

function encrypt(message, public_key) {
    let key = public_key
        .replace("------Bomes Public Key Begin------\n", "")
        .replace("\n------Bomes Public Key End------", "");
    let trashSize = key.charCodeAt(0) - 80;
    key = key.slice(1, key.length);
    let codes = [];
    for (let i = 0; i < key.length; i++){
        codes.push(key.charCodeAt(i) - 80);
    }
    const trashArray = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let data = "";
    let addTrashData = () => {
        for (let i = 0; i < trashSize; i++){
            data += trashArray[getRandomInt(0, trashArray.length)];
        }
    }
    addTrashData();
    data += message;
    addTrashData();
    let result = [];
    for (let i = 0; i < data.length; i++) {
        result.push(data.charCodeAt(i) << codes[i % codes.length]);
    }
    return JSON.stringify(result);
}

function decrypt(message, private_key) {
    let key = private_key
        .replace("------Bomes Private Key Begin------\n", "")
        .replace("\n------Bomes Private Key End------", "");
    let trashSize = key.charCodeAt(0) / 5 - 20;
    key = key.slice(1, key.length);
    let codes = [];
    for (let i = 0; i < key.length; i++){
        codes.push(key.charCodeAt(i) / 5 - 20);
    }
    message = JSON.parse(message);
    let result = "";
    for (let i = 0; i < message.length; i++) {
        result += String.fromCharCode(message[i] >> codes[i % codes.length]);
    }
    return result.slice(trashSize, result.length-trashSize);
}

module.exports = {
    generateKeys,
    encrypt,
    decrypt
}