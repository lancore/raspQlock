'use strict';

// TODO: sound, time sync, save settings

var config = require('./config.json'),
    clock,
    httpServer

// since we can't change the system time, patch the Date object
// to return the systemdate with time difference
Date = (function () {
    var NativeDate = Date

    function DateAdjusted(year, month, date, hour, minute, second, ms) {
        var d;
        // just can't seem figure out how to call the constructor with apply...
        switch (arguments.length) {
        case 0:
            d = new NativeDate()
            d.setTime(d.getTime() + DateAdjusted.timeDiff)
            return d;
        case 1:
            return new NativeDate(year)
        case 2:
            return new NativeDate(year, month)
        case 3:
            return new NativeDate(year, month, date)
        case 4:
            return new NativeDate(year, month, date, hour)
        case 5:
            return new NativeDate(year, month, date, hour, minute)
        case 6:
            return new NativeDate(year, month, date, hour, minute, second)
        default:
            return new NativeDate(year, month, date, hour, minute, second, ms)
        }
    }

    //mirror Date properties
    DateAdjusted.now = function () {
        return NativeDate.now() + DateAdjusted.timeDiff
    }
    DateAdjusted.toString = function toString() {
        return NativeDate.toString()
    }
    DateAdjusted.prototype = NativeDate.prototype
    DateAdjusted.parse = NativeDate.parse
    DateAdjusted.UTC = NativeDate.UTC
    DateAdjusted.timeDiff = 0

    return DateAdjusted
}())

clock = require('./clock.js').create(config)

// start the webserver
if (config.enableWebServer) {
    config.webServer = config.webServer || {}
    config.webServer.port = config.webServer.port || 88

    httpServer = require('./httpServer.js').create(clock)

    httpServer.listen(config.webServer.port, function () {
       // console.log('server listening')
    })
}

// start the clock
clock.start()
