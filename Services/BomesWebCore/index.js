const express = require("express");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));

app.get('/', (req, res) => {
    res.send("Successful request!");
});


app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});