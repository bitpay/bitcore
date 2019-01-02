var $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

var LocalLock = require('./locallock');
var RemoteLock = require('locker');
var Common = require('./common');
var Defaults = Common.Defaults;

var Errors = require('./errors/errordefinitions');

function Lock(opts) {
  opts = opts || {};
  if (opts.lockerServer) {
    this.lock = new RemoteLock(opts.lockerServer.port, opts.lockerServer.host);

    log.info('Using locker server:' + opts.lockerServer.host + ':' + opts.lockerServer.port);

    this.lock.on('reset', function() {
      log.debug('Locker server reset');
    });
    this.lock.on('error', function(error) {
      log.error('Locker server threw error', error);
    });
  } else {
    this.lock = new LocalLock();
  }
};

Lock.prototype.runLocked = function(token, cb, task, waitTime) {
  $.shouldBeDefined(token);

  waitTime = waitTime || Defaults.LOCK_WAIT_TIME;

  this.lock.locked(token, waitTime , Defaults.LOCK_EXE_TIME, function(err, release) {
    if (err) return cb(Errors.WALLET_BUSY);
    var _cb = function() {
      cb.apply(null, arguments);
      release();
    };
    task(_cb);
  });
};

module.exports = Lock;
