    var syslog = require('../lib/syslog-console.js').init('Test');

    syslog.log('Log');
    syslog.info('Info');
    syslog.debug('Debug');
    syslog.warn('Warn');
    syslog.error('Error');
    syslog.alert('Alert');
    syslog.critical('Critical');
    syslog.emergency('Emergency');

    syslog.setBuildType('frame');
    
    syslog.error({action: 'error', error: new Error('This is an Error')});

    var oRecursive = {
        test: 1
    };

    oRecursive.recurse = oRecursive;
    oRecursive.recurse2 = {
        error: new Error('whatever'),
        and: oRecursive
    };
    syslog.error({action: 'recursive', error: oRecursive});