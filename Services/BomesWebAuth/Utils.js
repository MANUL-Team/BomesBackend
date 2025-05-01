function getRandomInt(min, max){
    return Math.floor(Math.random() * (max - min)) + min;
}

function log(value){
    console.log(getLogTime() + "[I] " + value);
}
function error(value){
    console.log(getLogTime() + "[E] " + value);
}

function getLogTime(){
    const time = new Date();
    let hours = time.getHours();
    if (hours.toString().length === 1) hours = "0" + hours;
    let minutes = time.getMinutes();
    if (minutes.toString().length === 1) minutes = "0" + minutes;
    let seconds = time.getSeconds();
    if (seconds.toString().length === 1) seconds = "0" + seconds;
    return "[" + hours + ":" + minutes + ":" + seconds + "] ";
}

module.exports = {
    getRandomInt,
    log,
    error
}
