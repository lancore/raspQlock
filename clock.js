'use strict';
var fs = require('fs')

function noop() {}

exports.create = function (settings) {

    var clock = {},
        run = false,
        lastUpdate,
        leds = [],
        newSettings,
        stripLength,
        fd


    // set default settings
    settings = settings || {}
    settings.spiFile = settings.spiFile || '/dev/spidev0.0'
    settings.updateInterval = settings.updateInterval || 0
    settings.matrixTranslate = settings.matrixTranslate || []
    settings.words = settings.words || {}
    settings.globalColor = settings.color || {r: 255, g: 255, b: 255}
    settings.channelOrder = settings.channelOrder || 'brg'
    settings.mode = settings.mode || 'time'
    settings.animation = settings.animation || 'fade'
    settings.timeDiff = settings.timeDiff || 0
    settings.webServer = settings.webServer || {}
    settings.webServer.port = settings.webServer.port || 88
    if (settings.enableWebServer !== false) {
        settings.enableWebServer = true
    }

    var sendToStrip = function (newLeds, callback) {
        var strip = [], data = [], i, pos, min, buf

        // translate the 2D matrix to the led strip
        for (i = 0; i < newLeds.length; i++) {
            pos = settings.matrixTranslate[newLeds[i].y][newLeds[i].x]
            strip[pos] = newLeds[i]
        }

        // add corner LEDs and other stuff that isn't animated
        if (settings.mode === 'time') {
            min = new Date().getMinutes() % 5
            for (i=0; i<min;i++){
                if(settings.words.corners[i]){
                    pos = settings.matrixTranslate[settings.words.corners[i][1]][settings.words.corners[i][0]]
                    strip[pos] = { color: settings.globalColor }
                }
            }
        }

        for (i = 0; i < stripLength; i++) {
            if (strip[i]) {
                data.push(Math.floor(strip[i].color[settings.channelOrder[0]] / 2) + 0x80)
                data.push(Math.floor(strip[i].color[settings.channelOrder[1]] / 2) + 0x80)
                data.push(Math.floor(strip[i].color[settings.channelOrder[2]] / 2) + 0x80)
            }
            else {
                data.push(0x80)
                data.push(0x80)
                data.push(0x80)
            }
        }

        // send 4 nullbytes at the end to avoid some strange behavior
        data.push(0x0)
        data.push(0x0)
        data.push(0x0)
        data.push(0x0)

        // TODO: write to spi
        buf = new Buffer(data)
        //fs.write(fd, buf, 0, buf.length, 0, callback)
        console.log(buf.toString('hex'))
        process.nextTick(callback)
    }

    // clock modes
    var modes = {
        time: function () {
            var now = new Date(),
                hour, min,
                coords = []


            min = now.getMinutes()

            // only update if anything changed
            if (min !== lastUpdate) {
                lastUpdate = min

                // round minutes off to the next multiplier of 5
                min -= min % 5

                // convert hour to 12h format
                hour = now.getHours()
                if (hour > 12) {
                    hour -= 12
                }
                if (min > settings.words.incHourAt) {
                    hour++
                }

                // set time
                if (settings.words.static) {
                    coords = coords.concat(settings.words.static)
                }
                if (settings.words.hours && settings.words.hours[hour]) {
                    coords = coords.concat(settings.words.hours[hour])
                }
                if (settings.words.minutes && settings.words.minutes[min]) {
                    coords = coords.concat(settings.words.minutes[min])
                }

                return coords
            }
        },
        randomNoise: function () {
            var now, coords = []

            var getRnd = function (min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min
            }

            now = new Date()
            if (now.getTime() > lastUpdate + 50) {
                for (var l = 0; l < 20; l++) {
                    coords.push([getRnd(0, 10), getRnd(0, 9)])
                }
                lastUpdate = now.getTime()
                return coords
            }
        }
    }

    //animations
    var animations = {
        fade: function (coords, callback) {
            var duration = 1000,
                steps, colorSteps,
                colorIn = {r: 0, g: 0, b: 0},
                colorOut = {
                    r: settings.globalColor.r,
                    g: settings.globalColor.g,
                    b: settings.globalColor.b
                },
                ledsIn = [],
                ledsOut = [],
                ledsFull = [],
                i, j

            steps = Math.floor(duration / 25)
            colorSteps = {
                r: settings.globalColor.r / steps,
                g: settings.globalColor.g / steps,
                b: settings.globalColor.b / steps
            }

            // old leds
            for (i = 0; i < leds.length; i++) {
                // check if led is still on or fading out
                for (j = 0; j < coords.length; j++) {
                    if (leds[i].x === coords[j][0] && leds[i].y === coords[j][1]) {
                        // still on
                        ledsFull.push({
                            x: leds[i].x,
                            y: leds[i].y,
                            color: leds[i].color
                        })
                        coords.splice(j,1)
                        break;
                    }

                    // fading out
                    if(j === coords.length -1) {
                        ledsOut.push({
                            x: leds[i].x,
                            y: leds[i].y,
                            color: leds[i].color
                        })
                    }
                }
            }

            // fading in
            for (i = 0; i < coords.length; i++) {
                ledsIn.push({
                    x: coords[i][0],
                    y: coords[i][1],
                    color: colorIn
                })
            }

            var sendFrame = function (step) {
                // set colors
                colorIn.r += colorSteps.r
                colorIn.g += colorSteps.g
                colorIn.b += colorSteps.b

                colorOut.r -= colorSteps.r
                colorOut.g -= colorSteps.g
                colorOut.b -= colorSteps.b

                if (colorOut.r < 0) {
                    colorOut.r = 0
                }
                if (colorOut.g < 0) {
                    colorOut.g = 0
                }
                if (colorOut.b < 0) {
                    colorOut.b = 0
                }

                if (colorIn.r > settings.globalColor.r) {
                    colorIn.r = settings.globalColor.r
                }
                if (colorIn.g > settings.globalColor.g) {
                    colorIn.g = settings.globalColor.g
                }
                if (colorIn.b > settings.globalColor.b) {
                    colorIn.b = settings.globalColor.b
                }

                // update colors
                for (i = 0; i < ledsIn.length; i++) {
                    ledsIn[i].color = colorIn;
                }
                // update colors
                for (i = 0; i < ledsOut.length; i++) {
                    ledsOut[i].color = colorOut;
                }

                sendToStrip(ledsFull.concat(ledsIn, ledsOut), function () {
                    if (step >= steps) {
                        leds = ledsFull.concat(ledsIn)
                        return callback()
                    }
                    sendFrame(step + 1)
                })
            }

            sendFrame(0)
        },
        none: function (coords, callback) {
            var i, newLeds = []
            for (i = 0; i < coords.length; i++) {
                newLeds.push({
                    x: coords[i][0],
                    y: coords[i][1],
                    color: settings.globalColor
                })
            }
            sendToStrip(newLeds, function () {
                leds = newLeds
                callback()
            })
        }
    }

    // the main loop
    var mainLoop = function () {
        var coords

        if (run) {

            if (newSettings) {
                updateSettings()
            }

            // render current mode
            coords = modes[settings.mode]()
            if (coords) {
                animations[settings.animation](coords, function () {
                    setTimeout(mainLoop, settings.updateInterval)
                })
            } else {
                setTimeout(mainLoop, settings.updateInterval)
            }
        }
    }

    var updateSettings = function () {
        newSettings = newSettings || {}

        if (newSettings.updateInterval || newSettings.updateInterval === 0) {
            settings.updateInterval = newSettings.updateInterval
        }
        if (newSettings.matrixTranslate) {
            leds = []
            settings.matrixTranslate = newSettings.matrixTranslate
            stripLength = (settings.matrixTranslate[0]) ?
                settings.matrixTranslate.length * settings.matrixTranslate[0].length : 0
        }
        if (newSettings.words) {
            settings.words = newSettings.words
        }
        if (newSettings.globalColor) {
            if(isNaN(newSettings.globalColor.r)) {
                settings.globalColor.r = 255
            } else if (newSettings.globalColor.r > 255) {
                settings.globalColor.r = 255
            } else if (newSettings.globalColor.r < 0) {
                settings.globalColor.r = 0
            } else {
                settings.globalColor.r = newSettings.globalColor.r
            }
            if(isNaN(newSettings.globalColor.g)) {
                settings.globalColor.g = 255
            } else if (newSettings.globalColor.g > 255) {
                settings.globalColor.g = 255
            } else if (newSettings.globalColor.g < 0) {
                settings.globalColor.g = 0
            } else {
                settings.globalColor.g = newSettings.globalColor.g
            }
            if(isNaN(newSettings.globalColor.b)) {
                settings.globalColor.b = 255
            } else if (newSettings.globalColor.b > 255) {
                settings.globalColor.b = 255
            } else if (newSettings.globalColor.b < 0) {
                settings.globalColor.b = 0
            } else {
                settings.globalColor.b = newSettings.globalColor.b
            }
        }
        if (newSettings.channelOrder &&
            newSettings.channelOrder.length === 3 &&
            newSettings.channelOrder.indexOf('r') > -1 &&
            newSettings.channelOrder.indexOf('g') > -1 &&
            newSettings.channelOrder.indexOf('r') > -1
        ) {
            settings.channelOrder = newSettings.channelOrder
        }
        if (newSettings.mode && modes[newSettings.mode]) {
            leds = []
            settings.mode = newSettings.mode
        }
        if (newSettings.animation && animations[newSettings.animation]) {
            settings.animation = newSettings.animation
        }
        if (newSettings.timeDiff || newSettings.timeDiff === 0) {
            settings.timeDiff = newSettings.timeDiff
            Date.timeDiff = settings.timeDiff
        }

        // write settings to config
        fs.writeFile(__dirname + '/config.json', JSON.stringify(settings, null, ' '))

        lastUpdate = null
        newSettings = null
    }

    // starts the main loop
    clock.start = function (callback) {
        callback = callback || noop
        run = true
        fs.open(settings.spiFile, 'w', function (err, filedescriptor){
            if (err) {
                return callback(err)
            }

            fd = filedescriptor
            mainLoop()
            return callback()
        })
    }

    // stops the main loop
    clock.stop = function () {
        run = false
    }

    // change the clock settings
    clock.changeSettings = function (options) {
        // queue the change for the next frame loop while running,
        // in case the clock is in the middle of an animation
        newSettings = options

        if (!run) {
            updateSettings()
        }
    }

    // return clock settings
    clock.getSettings = function (setting) {
        if (setting) {
            return newSettings[setting] || settings[setting]
        } else {
            return newSettings || settings
        }
    }

    // return list of available animations
    clock.getAnimations = function () {
        var arr = [], i
        for(i in animations) {
            if (animations.hasOwnProperty(i)) {
                arr.push(i)
            }
        }
        return arr
    }

    // return list of available clock modes
    clock.getModes = function () {
        var arr = [], i
        for(i in modes) {
            if (modes.hasOwnProperty(i)) {
                arr.push(i)
            }
        }
        return arr
    }

    stripLength = settings.matrixTranslate[0] ?
        settings.matrixTranslate.length * settings.matrixTranslate[0].length : 0

    return clock
}
