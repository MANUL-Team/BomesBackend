const express = require("express");
const cors = require("cors");
const request = require('request');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded());
app.use(cors({credentials: true, origin: true}));

app.get('/', (req, res) => {
    console.log("IP: " + req.ip.slice(7));
    res.send("Successful request!");
});

app.get("/test_request", (req, res) => {
    console.log("Test request, IP: " + req.ip.slice(7));
    res.send("Success from auth");
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

request.post(
    {
        url: 'http://172.20.1.140:3000/register_service',
        form: {
            data: JSON.stringify({
                port,
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
            console.log("REGISTERED!");
        }
    }
);
