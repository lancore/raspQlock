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
        var t
        if(req.params.setting && req.contentType === 'application/json') {
            req.params[req.params.setting] = req.params
        } else if (req.params.setting) {
            req.params[req.params.setting] = req.body
        }

        if(req.params.time) {
            t = Date.parse(req.params.time)
            if(!isNaN(t)) {
                req.params.timeDiff = Date.timeDiff + t - Date.now()
            }
        }

        clock.changeSettings(req.params)
        res.send()
        return next()
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
    server.post('/setting/:setting', function (req, res, next) {
        req.params = {time: req.body}
        setSettings(req, res, next)
    })
    server.put('/time', function (req, res, next) {
        req.params = {time: req.body}
        setSettings(req, res, next)
    })
    server.post('/time', setSettings)

    server.get('/time', function (req, res, next) {
        res.send(new Date(Date.now()))
        return next()
    })

    server.get('/animations', function (req, res, next) {
        res.send(clock.getAnimations())
        return next()
    })
    server.get('/modes', function (req, res, next) {
        res.send(clock.getModes())
        return next()
    })

    return server
}
