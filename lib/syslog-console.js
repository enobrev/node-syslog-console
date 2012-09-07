    /*============================================================================
      Copyright(c) 2011 Mark Armendariz <src@enobrev.com>
      MIT Licensed
    ============================================================================*/

    var Syslog = require('node-syslog');
    var crypto = require('crypto');
    var tty    = require('tty');
    var util   = require('util');

    var SyslogConsole = function(sDomain, iFacility) {
        this.oClient = Syslog;
        this.oClient.init(sDomain, Syslog.LOG_PID | Syslog.LOG_ODELAY, iFacility);
        this.oTimers  = {};
        this.oPersist = {};
        this.bPaused  = false;
    };

    SyslogConsole.TTY = true;

    SyslogConsole.init = function(sDomain) {
        return new SyslogConsole(sDomain, Syslog.LOG_LOCAL0);
    };

    SyslogConsole.initDaemon = function(sDomain) {
        return new SyslogConsole(sDomain, Syslog.LOG_DAEMON);
    };

    SyslogConsole.prototype.pause = function(bPaused) {
        this.bPaused = bPaused !== undefined ? bPaused : true;
    };

    SyslogConsole.prototype.persist = function(sKey, sValue) {
        this.oPersist[sKey] = sValue;
    };

    SyslogConsole.prototype._findErrors = function(mMessage) {
        if (mMessage instanceof Object) {
            for (var i in mMessage) {
                var oMessage = mMessage[i];
                if (oMessage instanceof Error) {
                    this.send({action: "Error Details", error: {message: oMessage.message, type: oMessage.type, arguments: oMessage.arguments, stack: oMessage.stack.split("\n")}}, this.oClient.LOG_ERR);
                } else {
                    this._findErrors(oMessage);
                }
            }
        }
    };

    SyslogConsole.prototype.disableTTY = function() {
        SyslogConsole.TTY = false;
    };

    SyslogConsole.prototype.enableTTY = function() {
        SyslogConsole.TTY = true;
    };

    SyslogConsole.prototype.send = function(mMessage, iSeverity) {
        if (this.bPaused) {
            return;
        }

        if (SyslogConsole.TTY && tty.isatty(process.stdout.fd)) {
            try {
                var sAction = '';
                if (mMessage.action !== undefined) {
                    sAction = mMessage.action;
                    delete mMessage.action;
                }

                var sSeverity   = this._getSeverityStringFromInt(iSeverity);
                var sTTYMessage = util.inspect(mMessage, true, 4, true);
                if (console[sSeverity] !== undefined) {
                    console[sSeverity](sSeverity, sAction, sTTYMessage);
                } else {
                    console.log(sSeverity, sAction, sTTYMessage);
                }
            } catch (e) {
                console.log('Had Some Trouble outputting to Console');
                console.log(mMessage);
            }
        }

        this._findErrors(mMessage);
        if (mMessage instanceof Object) {
            for (var sKey in this.oPersist) {
                if (mMessage[sKey] === undefined) {
                    mMessage[sKey] = this.oPersist[sKey];
                }
            }

            mMessage = JSON.stringify(mMessage);
        } else {
            mMessage += ' ' + JSON.stringify(mMessage);
        }

        var sHash    = crypto.createHash('sha1').update(mMessage).digest('hex').substring(0, 8);
        var aMessage = mMessage.match(/.{1,896}/g);
        var iMessage = aMessage.length;
        for (var iIndex in aMessage) {
            var sMessage = '';

            if (iMessage > 1) {
                sMessage += '[[[' + sHash + '|' + iIndex + '|' + iMessage + ']]] ';
            }

            sMessage += aMessage[iIndex];

            this.oClient.log(iSeverity, sMessage);
        }
    };

    SyslogConsole.prototype._getSeverityStringFromInt = function(iSeverity) {
        switch(iSeverity) {
            case this.oClient.LOG_EMERG:    return 'emergency'; break;
            case this.oClient.LOG_ALERT:    return 'alert';     break;
            case this.oClient.LOG_CRIT:     return 'critical';  break;
            case this.oClient.LOG_ERR:      return 'error';     break;
            case this.oClient.LOG_WARNING:  return 'warning';   break;
            case this.oClient.LOG_NOTICE:   return 'notice';    break;
            case this.oClient.LOG_INFO:     return 'info';      break;
            case this.oClient.LOG_DEBUG:    return 'debug';     break;
        }
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

    SyslogConsole.prototype.alert = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_ALERT);
    };

    SyslogConsole.prototype.critical = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_CRIT);
    };

    SyslogConsole.prototype.emergency = function(mMessage) {
        this.send(mMessage, this.oClient.LOG_EMERG);
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

    SyslogConsole.prototype.timeStart = function(mMessage) {
        if (mMessage !== undefined) {
            this.log(mMessage);
        }
        
        return Date.now();
    };

    SyslogConsole.prototype.timeStop = function(iStart, mMessage) {
        var iTime = Date.now() - iStart;
        if (mMessage instanceof Object) {
            mMessage.duration = iTime;
        } else {
            mMessage += ' ' + iTime + 'ms'
        }

        this.log(mMessage);
        return iTime;
    };

    module.exports = SyslogConsole;
