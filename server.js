const Express = require("express");
const HTTPS = require("https");
const FS = require("fs");
const request = require("request");
var app = Express();

var path = require('path');

app.use(Express.static(path.join(__dirname, '')));

app.get("/", (request, response, next) => {
    // response.send({ "message": "Hello Melvin" });
    response.sendFile(__dirname + '/Home.html');
});

app.get("/pullFullData", (req, res) => {
    let options = {
        url: "http://localhost:8080/api/1/repo/retrieve_records",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.query),
        method: "POST"
    }
    request(options, (error, response, body) => {
        console.log("HUEHUEHUEHEUHEUH===============>")
        res.send(body)
    })

});

app.get("/pullPartialData", (req, res) => {
    let options = {
        url: "http://localhost:8080/api/1/repo/retrieve_records",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.query),
        method: "POST"
    }
    request(options, (error, response, body) => {
        console.log("HUEHUEHUEHEUHEUH===============>")
        res.send(body)
    })
});
app.get("/saveMapping", (req, res) => {
    let options = {
        url: "http://localhost:8080/api/1/saveSettings",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.query),
        method: "POST"
    }
    request(options, (error, response, body) => {
        console.log("SETTINGS SAVED!===============>")

        res.send(body)
    })
});
app.get("/retrieveMapping", (req, res) => {
    let options = {
        url: "http://localhost:8080/api/1/getsettings",
        headers: { 'content-type': 'application/json' },
        qs: req.query,
        method: "GET"
    }

    request(options, (error, response, body) => {
        console.log("SETTINGS RETRIEVED!!===============>")
        res.send(JSON.parse(body))
    })
});

app.get("/getRepoDetails", (req, res) => {
    request(`http://localhost:8080/api/1/query/repo/getrepotable?api_token=${req.query.api_token}&repo_id=${req.query.repo_id}`, (err, resp, body) => {
        res.send(JSON.parse(body))
    })
})

app.get("/getRepoTypes", (req, res) => {
    request(`http://localhost:8080/api/1/query/repo/getrepotype?api_token=${req.query.api_token}`, (err, resp, body) => {
        res.send(JSON.parse(body))
    })
})
app.get("/getUserProjects", (req, res) => {
    console.log("GETTING PROJECTS ===========>")

    request(`http://localhost:8080/api/1/getAllProjects?api_token=${req.query.api_token}`, (err, resp, body) => {
        res.send(JSON.parse(body))
    })
})

app.get("/getUserPhases", (req, res) => {
    console.log("GETTING PHASE ===========>")
    let propertiesObject = {
        api_token: req.query.api_token
    }
    let id = 'all';
    let url = `http://localhost:8080/api/1/query/phase/getphase/${id}`
    request({ url:url , qs: propertiesObject }, (err, resp, body) => {
        res.send(JSON.parse(body))
    })
})

app.get("/updateRecord", (req, res) => {
    console.log("=====> sending update rest api", req.query)
    var options = {
        "method": "PATCH",
        "url": 'http://localhost:8080/api/1/audit/updateViaExternal',
        "headers": {
            "Cache-Control": "no-cache",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        "form": req.query

    }

    request(options, function (error, response, body) {
        if (error) {
            throw new Error(error);
        }
        res.send();
    });
})

app.get("/login", (req, res) => {
    let options = {
        url: "http://localhost:8080/api/1/login",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.query),
        method: "POST"
    }
    request(options, (error, response, body) => {
        console.log("HUEHUEHUEHEUHEUH===============>")
        if (typeof body == "string") {
            body = JSON.parse(body)
        }
        res.send(body)
    })

});

HTTPS.createServer({
    key: FS.readFileSync("server.key"),
    cert: FS.readFileSync("server.cert")
}, app).listen(443, () => {
    console.log("Listening at :443...");
});