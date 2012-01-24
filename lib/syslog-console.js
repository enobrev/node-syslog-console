/*============================================================================
  Copyright(c) 2011 Mark Armendariz <src@enobrev.com>
  MIT Licensed
============================================================================*/
    var Syslog = require('node-syslog');

    var SyslogConsole = function(sDomain, iFacility) {
        this.oClient = Syslog;
        this.oClient.init(sDomain, Syslog.LOG_PID | Syslog.LOG_ODELAY, iFacility);
        this.oTimers  = {};
        this.oPersist = {};
    };

    SyslogConsole.init = function(sDomain) {
        return new SyslogConsole(sDomain, Syslog.LOG_LOCAL0);
    };

    SyslogConsole.initDaemon = function(sDomain) {
        return new SyslogConsole(sDomain, Syslog.LOG_DAEMON);
    };

    SyslogConsole.prototype.persist = function(sKey, sValue) {
        this.oPersist[sKey] = sValue;
    };

    SyslogConsole.prototype.send = function(mMessage, iSeverity) {
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

    SyslogConsole.prototype.log = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_NOTICE);
    };

    SyslogConsole.prototype.info = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_INFO);
    };

    SyslogConsole.prototype.warn = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_WARN);
    };

    SyslogConsole.prototype.error = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_ERR);
    };

    SyslogConsole.prototype.debug = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_DEBUG);
    };

    SyslogConsole.prototype.time = function(sLabel) {
        this.oTimers[sLabel] = Date.now();
    };

    SyslogConsole.prototype.timeEnd = function(sLabel, mMessage) {
        var iDuration = Date.now() - this.oTimers[sLabel];
        if (mMessage instanceof Object) {
            mMessage.duration = iDuration;
        } else {
            mMessage += ' ' + iDuration + 'ms'
        }

        this.log(mMessage);
    };

    SyslogConsole.prototype.timeStart = function() {
        return Date.now();
    };

    SyslogConsole.prototype.timeStop = function(iStart, mMessage) {
        if (mMessage instanceof Object) {
            mMessage.duration = Date.now() - iStart;
        } else {
            mMessage += ' ' + Date.now() - iStart + 'ms'
        }

        this.log(mMessage);
    };

    module.exports = SyslogConsole;
