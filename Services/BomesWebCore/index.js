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
    res.sendStatus(200);
});

app.post("/register_service", (req, res) => {
    if (!req.body) return res.sendStatus(400);
    req.body = JSON.parse(req.body.data);
    const server_ip = req.ip.slice(7);
    const server_port = req.body.port;
    const server_requests = req.body.requests;
    for (let i = 0; i < server_requests.length; i++) {
        if (server_requests[i].type === "GET"){
            app.get(server_requests[i].value, (r, rs) => {
                request(`http://${server_ip}:${server_port}${server_requests[i].value}`,
                    (err, response, body) => {
                        if (err) return rs.status(400).send({error: err});
                        return rs.send(body);
                    }
                );
            });
        }
        else if (server_requests[i].type === "POST") {
            app.post(server_requests[i].value, (r, rs) => {
                request.post(
                    {
                        url: `http://${server_ip}:${server_port}${server_requests[i].value}`,
                        form: r.body
                    },
                    (err, response, body) => {
                        if (err) return rs.status(400).send({error: err});
                        return rs.send(body);
                    }
                );
            });
        }
    }
    res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
