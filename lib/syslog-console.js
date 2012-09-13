    /*============================================================================
      Copyright(c) 2011 Mark Armendariz <src@enobrev.com>
      MIT Licensed
    ============================================================================*/

    var Syslog = require('node-syslog');
    var crypto = require('crypto');
    var tty    = require('tty');
    var util   = require('util');

    /**
     *
     * @param {String} sDomain
     * @param {Integer} iFacility
     * @constructor
     */
    var SyslogConsole = function(sDomain, iFacility) {
        this.oClient = Syslog;
        this.oClient.init(sDomain, Syslog.LOG_PID | Syslog.LOG_ODELAY, iFacility);

        this.sDomain   = sDomain;
        this.iFacility = iFacility;
        this.oTimers   = {};
        this.oPersist  = {};
        this.bPaused   = false;
    };

    SyslogConsole.TTY     = true;
    SyslogConsole.REQUEST = null;

    /**
     *
     * @param {String} sDomain
     * @return {SyslogConsole}
     */
    SyslogConsole.init = function(sDomain) {
        return new SyslogConsole(sDomain, Syslog.LOG_LOCAL0);
    };

    /**
     *
     * @param {String} sDomain
     * @return {SyslogConsole}
     */
    SyslogConsole.initDaemon = function(sDomain) {
        return new SyslogConsole(sDomain, Syslog.LOG_DAEMON);
    };

    /**
     *
     * @param {Boolean} bPaused
     */
    SyslogConsole.prototype.pause = function(bPaused) {
        this.bPaused = bPaused !== undefined ? bPaused : true;
    };

    /**
     *
     * @param {String} sKey
     * @param {*} sValue
     */
    SyslogConsole.prototype.persist = function(sKey, sValue) {
        this.oPersist[sKey] = sValue;
    };

    /**
     *
     * @param {*} mMessage
     * @private
     */
    SyslogConsole.prototype._findErrors = function(mMessage) {
        if (mMessage instanceof Object) {
            for (var i in mMessage) {
                var oMessage = mMessage[i];
                if (oMessage instanceof Error) {
                    this._send({action: "Error Details", error: {message: oMessage.message, type: oMessage.type, arguments: oMessage.arguments, stack: oMessage.stack.split("\n")}}, this.oClient.LOG_ERR);
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

    SyslogConsole.prototype.resetRequestHash = function() {
        SyslogConsole.REQUEST = null;
    };

    /**
     *
     * @return {String}
     */
    SyslogConsole.prototype.getRequestHash = function() {
        if (SyslogConsole.REQUEST === null) {
            var oDate = new Date;
            var aMessage = [this.sDomain, this.iFacility, process.pid];
            try {
                aMessage.push(oDate.toISOString().replace(/[^a-zA-Z0-9]/g, '_'));
            } catch (e) {
                // shhhhhh
            }

            SyslogConsole.REQUEST = crypto.createHash('sha1').update(aMessage.join('-')).digest('hex');
        }

        return SyslogConsole.REQUEST;
    };

    /**
     *
     * @param {Object|String} mMessage
     * @param {Integer} iSeverity
     * @private
     */
    SyslogConsole.prototype._send = function(mMessage, iSeverity) {
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
                console.log(sSeverity, sAction, sTTYMessage);
            } catch (e) {
                console.error('SYSLOG_ERROR', 'Had Some Trouble outputting to Console');
                console.error('SYSLOG_ERROR', e);
                console.error('SYSLOG_ERROR_MESSAGE', mMessage);
            }
        }

        this._findErrors(mMessage);
        if (mMessage instanceof Object) {
            mMessage.__request = this.getRequestHash();

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

    /**
     *
     * @param {Integer} iSeverity
     * @return {String}
     * @private
     */
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

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.log = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_NOTICE);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.info = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_INFO);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.warn = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_WARNING);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.error = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_ERR);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.debug = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_DEBUG);
    };

    /**
     *
     * @param {Object|String} mMessage
     */

    SyslogConsole.prototype.alert = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_ALERT);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.critical = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_CRIT);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.emergency = function(mMessage) {
        this._send(mMessage, this.oClient.LOG_EMERG);
    };

    /**
     *
     * @param {String} sLabel
     */
    SyslogConsole.prototype.time = function(sLabel) {
        this.oTimers[sLabel] = Date.now();
    };

    /**
     *
     * @param {String} sLabel
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.timeEnd = function(sLabel, mMessage) {
        var iDuration = Date.now() - this.oTimers[sLabel];
        if (mMessage instanceof Object) {
            mMessage.duration = iDuration;
        } else {
            mMessage += ' ' + iDuration + 'ms'
        }

        this.log(mMessage);
    };

    /**
     *
     * @param {Object|String} [mMessage]
     * @return {Integer}
     */
    SyslogConsole.prototype.timeStart = function(mMessage) {
        if (mMessage !== undefined) {
            this.log(mMessage);
        }
        
        return Date.now();
    };

    /**
     *
     * @param {Integer} iStart Returned from timeStart
     * @param {Object|String} [mMessage]
     * @return {Integer}
     */
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
