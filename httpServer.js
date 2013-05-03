'use strict';
var restify = require('restify')

exports.create = function (clock) {
    var server = restify.createServer();

    var getSettings = function(req, res, next) {
        if (req.params && req.params.setting) {
            res.send(JSON.stringify(clock.getSettings(req.params.setting), null, ' '))
        } else {
            res.send(clock.getSettings())
        }
        return next()
    }

    var setSettings = function(req, res, next) {
        if(req.params.setting && req.contentType === 'application/json') {
            req.params[req.params.setting] = req.params
        } else if (req.params.setting) {
            req.params[req.params.setting] = req.body
        }
        clock.changeSettings(req.params)
        res.send()
        return next()
    }
    var setTime = function (req, res, next) {
        var t = Date.parse(req.body), diff
        if(!isNaN(t)) {
            diff = Date.timeDiff + t.getTime() - Date.now()
        } else {
            diff = Date.timeDiff
        }
        req.params = {timeDiff: diff}
        setSettings(req, res, next)
    }

//    server.use(restify.authorizationParser())
    server.use(restify.bodyParser())

    server.get('/test/:hi', function (req, res, next) {
        res.send(req.params.hi)
        return next()
    })

    server.get('/settings', getSettings)
    server.get('/setting/:setting', getSettings)
    server.put('/settings', setSettings)
    server.put('/setting/:setting', setSettings)
    server.post('/settings', setSettings)
    server.post('/setting/:setting', setSettings)
    server.put('/time', setTime)
    server.post('/time', setTime)
    server.get('/time', function (req, res, next) {
        res.send(new Date())
        return next()
    })

    return server
}
