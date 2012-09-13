    var syslog = require('../lib/syslog-console.js').init('Test');

    syslog.log('Log');
    syslog.info('Info');
    syslog.debug('Debug');
    syslog.warn('Warn');
    syslog.error('Error');
    syslog.alert('Alert');
    syslog.critical('Critical');
    syslog.emergency('Emergency');