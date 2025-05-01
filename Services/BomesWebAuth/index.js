require("dotenv").config();

const express = require("express");
const cors = require("cors");
const request = require('request');
const Utils = require("./Utils.js");

const app = express();
const PORT = process.env.PORT;

const CORE_ADDRESS = process.env.CORE_ADDRESS;

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));

app.get("/test_request", (req, res) => {
    Utils.log("Test request, IP: " + req.ip.slice(7));
    res.send("Success from auth");
});

app.listen(PORT, () => {
    Utils.log(`Сервер запущен на порту ${PORT}`);
});

request.post(
    {
        url: `http://${CORE_ADDRESS}/register_service`,
        form: {
            data: JSON.stringify({
                port: PORT,
                requests: [
                    {
                        type: "GET",
                        value: "/test_request"
                    }
                ]
            })
        }
    },
    (err, response, body) => {
        if (err) console.log(err);
        else {
            Utils.log("REGISTERED!");
        }
    }
);
