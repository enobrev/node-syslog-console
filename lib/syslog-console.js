/*============================================================================
  Copyright(c) 2011 Mark Armendariz <src@enobrev.com>
  MIT Licensed
============================================================================*/
    var Syslog = require('node-syslog');

    var LogglyConsole = function(sDomain, iFacility) {
        this.oClient = Syslog;
        this.oClient.init(sDomain, Syslog.LOG_PID | Syslog.LOG_ODELAY, iFacility);
        this.oTimers  = {};
        this.oPersist = {};
    };

    LogglyConsole.init = function(sDomain) {
        return new LogglyConsole(sDomain, Syslog.LOG_LOCAL0);
    };

    LogglyConsole.initDaemon = function(sDomain) {
        return new LogglyConsole(sDomain, Syslog.LOG_DAEMON);
    };

    LogglyConsole.prototype.persist = function(sKey, sValue) {
        this.oPersist[sKey] = sValue;
    };

    LogglyConsole.prototype.send = function(mMessage, iSeverity) {
        if (mMessage instanceof Object) {
            for (var sKey in this.oPersist) {
                if (mMessage[sKey] === undefined) {
                    mMessage[sKey] = this.oPersist[sKey];
                }
            }

            mMessage = JSON.stringify(mMessage);
        }

        this.oClient.log(iSeverity, mMessage);
    };

    LogglyConsole.prototype.log = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_NOTICE);
    };

    LogglyConsole.prototype.info = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_INFO);
    };

    LogglyConsole.prototype.warn = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_WARN);
    };

    LogglyConsole.prototype.error = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_ERR);
    };

    LogglyConsole.prototype.debug = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_DEBUG);
    };

    LogglyConsole.prototype.time = function(sLabel) {
        this.oTimers[sLabel] = Date.now();
    };

    LogglyConsole.prototype.timeEnd = function(sLabel, mMessage) {
        var iDuration = Date.now() - this.oTimers[sLabel];
        if (mMessage instanceof Object) {
            mMessage.duration = iDuration;
        } else {
            mMessage += ' ' + iDuration + 'ms'
        }

        this.log(mMessage);
    };

    LogglyConsole.prototype.timeStart = function() {
        return Date.now();
    };

    LogglyConsole.prototype.timeStop = function(iStart, mMessage) {
        if (mMessage instanceof Object) {
            mMessage.duration = Date.now() - iStart;
        } else {
            mMessage += ' ' + Date.now() - iStart + 'ms'
        }

        this.log(mMessage);
    };

    module.exports = LogglyConsole;
