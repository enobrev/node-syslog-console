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

        this.sDomain    = sDomain;
        this.iFacility  = iFacility;
        this.oStarts    = {};
        this.oTimers    = {};
        this.oPersist   = {};
        this.bPaused    = false;

        this.sMessageAction = 'syslog';
    };

    SyslogConsole.MAX_MSG   = 200000;
    SyslogConsole.TTY       = true;
    SyslogConsole.REQUEST   = null;
    SyslogConsole.PARENT    = null;
    SyslogConsole.THREAD    = null;
    SyslogConsole.USER      = null;
    SyslogConsole.BUILDTYPE = null;
    SyslogConsole.INDEX     = 0;

    SyslogConsole.RECORDING = false;
    SyslogConsole.RECORDS   = {};

    /**
     *
     * @param {String} sDomain
     * @param {String} [sParentHash]
     * @return {SyslogConsole}
     */
    SyslogConsole.init = function(sDomain, sParentHash) {
        if (sParentHash !== undefined) {
            this.setParentHash(sParentHash);
        }
        return new SyslogConsole(sDomain, Syslog.LOG_LOCAL0);
    };

    /**
     *
     * @param {String} sDomain
     * @param {String} [sParentHash]
     * @return {SyslogConsole}
     */
    SyslogConsole.initDaemon = function(sDomain, sParentHash) {
        if (sParentHash !== undefined) {
            this.setParentHash(sParentHash);
        }
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
     * @param {Boolean} bRecord
     */
    SyslogConsole.prototype.record = function(bRecord) {
        SyslogConsole.RECORDING = bRecord !== undefined ? bRecord : true;
    };

    SyslogConsole.prototype.getRecords = function() {
        return SyslogConsole.RECORDS;
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
     * @param {Number} iStack
     * @private
     */
    SyslogConsole.prototype._findErrors = function(mMessage, iStack) {
        iStack = iStack !== undefined ? iStack : 0;
        if (mMessage instanceof Object) {
            for (var i in mMessage) {
                var oMessage = mMessage[i];
                try {
                    if (util.isError(oMessage)) {
                        var oError = {
                            message:    oMessage.message,
                            type:       oMessage.type,
                            arguments:  oMessage.arguments
                        };

                        if (oMessage.stack) {
                            oError.stack = oMessage.stack.split("\n");
                        }

                        mMessage[i] = oError;
                    } else if (iStack <= 20) {
                        this._findErrors(oMessage, iStack + 1);
                    }
                } catch (e) {
                    console.error('SYSLOG_ERROR', e.message);
                    console.trace();
                }
            }
        }
    };

    SyslogConsole.prototype._handleRecording = function(mMessage) {
        if (SyslogConsole.RECORDING) {
            if (mMessage instanceof Object) {
                if (mMessage.__ms !== undefined) {
                    if (mMessage.action !== undefined) {
                        if (SyslogConsole.RECORDS[mMessage.action] === undefined) {
                            SyslogConsole.RECORDS[mMessage.action] = [];
                        }

                        SyslogConsole.RECORDS[mMessage.action].push(mMessage.__ms);
                    }
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

    SyslogConsole.prototype.setAction = function(sAction) {
        this.sMessageAction = sAction;
    };

    SyslogConsole.prototype.resetRequestHash = function() {
        SyslogConsole.REQUEST = null;
    };

    SyslogConsole.prototype.setParentHash = function(sHash) {
        SyslogConsole.PARENT = sHash;
    };

    SyslogConsole.prototype.setThreadHash = function(sHash) {
        SyslogConsole.THREAD = sHash;
    };

    SyslogConsole.prototype.setUserId = function(iUserId) {
        SyslogConsole.USER = iUserId;
    };

    SyslogConsole.prototype.setBuildType = function(sBuildType) {
        SyslogConsole.BUILDTYPE = sBuildType;
    };

    /**
     *
     * @param {Object}  oData
     * @param {Boolean} bRemoveThem
     */
    SyslogConsole.prototype.setHashes = function(oData, bRemoveThem) {
        bRemoveThem = bRemoveThem !== undefined ? bRemoveThem : false;

        if (oData.__t)          { this.setThreadHash(oData.__t);        }
        if (oData.__p)          { this.setParentHash(oData.__p);        }
        if (oData.__u)          { this.setUserId(    oData.__u);        }
        if (oData.buildType)    { this.setBuildType( oData.buildType);  }

        if (bRemoveThem) {
            delete oData.__t;
            delete oData.__p;
            delete oData.__u;
            delete oData.buildType;
        }
    };

    /**
     *
     * @return {String}
     */
    SyslogConsole.prototype.getParentHash = function() {
        return SyslogConsole.PARENT;
    };

    /**
     *
     * @return {String}
     */
    SyslogConsole.prototype.getThreadHash = function() {
        return SyslogConsole.THREAD;
    };

    /**
     *
     * @return {Integer}
     */
    SyslogConsole.prototype.getUserId = function() {
        return SyslogConsole.USER;
    };

    /**
     *
     * @return {Integer}
     */
    SyslogConsole.prototype.getRequestIndex = function() {
        SyslogConsole.INDEX++;
        return SyslogConsole.INDEX;
    };

    /**
     *
     * @return {String}
     */
    SyslogConsole.prototype.getBuildType = function() {
        return SyslogConsole.BUILDTYPE;
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

            SyslogConsole.REQUEST = crypto.createHash('sha1').update(aMessage.join('-')).digest('hex').substring(0, 8);
        }

        return SyslogConsole.REQUEST;
    };

    /**
     *
     * @param {Object|String} mMessage
     * @param {Integer} iSeverity
     * @param {Boolean} [bCheckForErrors]
     * @private
     */
    SyslogConsole.prototype._send = function(mMessage, iSeverity, bCheckForErrors) {
        if (this.bPaused) {
            return;
        }

        bCheckForErrors = bCheckForErrors !== undefined ? bCheckForErrors : true;

        if (bCheckForErrors) {
            switch(iSeverity) {
                case Syslog.LOG_EMERG:
                case Syslog.LOG_ALERT:
                case Syslog.LOG_CRIT:
                case Syslog.LOG_ERR:
                case Syslog.LOG_WARNING:
                    this._findErrors(mMessage);
                    break;
            }
        }

        this._handleRecording(mMessage);

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
                mMessage.action = sAction;
            } catch (e) {
                console.error('SYSLOG_ERROR', 'Had Some Trouble outputting to Console');
                console.error('SYSLOG_ERROR', e);
                console.error('SYSLOG_ERROR_MESSAGE', mMessage);
            }
        }

        if (mMessage instanceof Object) {
            mMessage.__s = this._getSeverityStringFromInt(iSeverity);
            mMessage.__r = this.getRequestHash();
            mMessage.__p = this.getParentHash();
            mMessage.__t = this.getThreadHash();
            mMessage.__i = this.getRequestIndex();
            var buildType = this.getBuildType();
            if (buildType !== null) {
                mMessage.buildType = buildType;
            }

            for (var sKey in this.oPersist) {
                if (mMessage[sKey] === undefined) {
                    mMessage[sKey] = this.oPersist[sKey];
                }
            }

            try {
                mMessage = JSON.stringify(mMessage);
            } catch (e) {
                console.error('SYSLOG_ERROR', 'Had Some Trouble outputting to Syslog');
                console.error('SYSLOG_ERROR', e);
                console.error('SYSLOG_ERROR_MESSAGE', mMessage);
                return;
            }
        } else {
            try {
                mMessage += ' ' + JSON.stringify(mMessage);
            } catch (e) {
                console.error('SYSLOG_ERROR', 'Had Some Trouble outputting to Syslog');
                console.error('SYSLOG_ERROR', e);
                console.error('SYSLOG_ERROR_MESSAGE', mMessage);
                return;
            }
        }

        var sHash = '';
        
        if (SyslogConsole.THREAD) {
            sHash += this.getThreadHash();
        }

        sHash += '.' + this.getRequestHash();
        sHash += '.' + crypto.createHash('sha1').update(mMessage).digest('hex').substring(0, 8);
        
        var oRegex   = new RegExp('.{1,' + SyslogConsole.MAX_MSG + '}', 'g');
        var aMessage = mMessage.match(oRegex);
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

    SyslogConsole.prototype.message = function(mMessage) {
        this.debug({action: this.sMessageAction, message: mMessage});
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.log = function(mMessage) {
        this.notice(mMessage);
    };

    /**
     *
     * @param {Object|String} mMessage
     */
    SyslogConsole.prototype.notice = function(mMessage) {
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
    SyslogConsole.prototype.warning = function(mMessage) {
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
     * @returns {number}
     */
    SyslogConsole.prototype.getTime = function(sLabel) {
        if (this.oStarts[sLabel] !== undefined) {
            return Date.now() - this.oStarts[sLabel];
        }

        return 0;
    };

    /**
     *
     * @param {String} sLabel
     * @param {Object|String} [mMessage]
     * @param {Integer} [iSeverity]
     */
    SyslogConsole.prototype.timeStart = function(sLabel, mMessage, iSeverity) {
        iSeverity = iSeverity !== undefined ? iSeverity : this.oClient.LOG_INFO;

        this.oStarts[sLabel] = Date.now();

        if (mMessage !== undefined) {
            if (mMessage instanceof Object) {
                mMessage.action = sLabel;
            } else {
                mMessage = sLabel + ' ' + mMessage;
            }

            this._send(mMessage, iSeverity);
        }

        return sLabel;
    };

    /**
     *
     * @param {String} sLabel
     * @param {Object|String} [mMessage]
     * @param {Integer} [iSeverity]
     * @return {Integer}
     */
    SyslogConsole.prototype.timeStop = function(sLabel, mMessage, iSeverity) {
        iSeverity = iSeverity !== undefined ? iSeverity : this.oClient.LOG_INFO;
        mMessage  = mMessage  !== undefined ? mMessage  : {};
        mMessage  = mMessage  !== null      ? mMessage  : {};

        var iDuration = 0;
        if (this.oStarts[sLabel] !== undefined) {
            iDuration = Date.now() - this.oStarts[sLabel];
            if (mMessage instanceof Object) {
                mMessage.__ms = iDuration;
            } else {
                mMessage += ' ' + iDuration + 'ms'
            }
        }

        if (mMessage instanceof Object) {
            mMessage.action = sLabel;
        } else {
            mMessage = sLabel + ' ' + mMessage;
        }

        this._send(mMessage, iSeverity);

        return iDuration;
    };

    SyslogConsole.PROCESS_NAME  = null;
    SyslogConsole.PROCESS_EXTRA = {};

    /**
     *
     * @param {String} [sAction]
     * @param {Object} [oExtra]
     * @returns {*}
     */
    SyslogConsole.prototype.processStart = function(sAction, oExtra) {
        SyslogConsole.PROCESS_NAME = sAction;

        if (oExtra) {
            SyslogConsole.PROCESS_EXTRA = oExtra;
        }

        SyslogConsole.PROCESS_NAME = this.timeStart(sAction, {action: sAction, __status: 'Start'}, this.oClient.LOG_NOTICE);
        return SyslogConsole.PROCESS_NAME;
    };

    /**
     *
     * @param {String} [sAction]
     * @param {Object} [mMessage]
     * @return {Integer}
     */
    SyslogConsole.prototype.processError = function(mMessage) {
        mMessage = mMessage instanceof Object ? mMessage : {};

        mMessage.action   = SyslogConsole.PROCESS_NAME;
        mMessage.__status = 'Error';
        mMessage.timers   = this._getOtherTimers(SyslogConsole.PROCESS_NAME);

        return this.timeStop(SyslogConsole.PROCESS_NAME, this._mergeExtra(mMessage), this.oClient.LOG_NOTICE);
    };

    /**
     *
     * @param {String} [sAction]
     * @param {Object} [mMessage]
     * @return {Integer}
     */
    SyslogConsole.prototype.processDone = function(mMessage) {
        mMessage = mMessage instanceof Object ? mMessage : {};

        mMessage.action   = SyslogConsole.PROCESS_NAME;
        mMessage.__status = 'Done';
        mMessage.timers   = this._getOtherTimers(SyslogConsole.PROCESS_NAME);

        return this.timeStop(SyslogConsole.PROCESS_NAME, this._mergeExtra(mMessage), this.oClient.LOG_NOTICE);
    };

    SyslogConsole.prototype._mergeExtra = function(oMessage) {
        for (var sParam in SyslogConsole.PROCESS_EXTRA) {
            oMessage[sParam] = SyslogConsole.PROCESS_EXTRA[sParam];
        }

        return oMessage;
    };

    SyslogConsole.prototype._getOtherTimers = function(sAction) {
        var oTimers = {};
        for (var sTimer in this.oTimers) {
            if (sTimer == sAction) {
                continue;
            }

            oTimers[sTimer] = this.oTimers[sTimer];
        }

        return oTimers;
    };

    module.exports = SyslogConsole;
