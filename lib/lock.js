var $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');
log.debug = log.verbose;

var LocalLock = require('./locallock');
var RemoteLock = require('locker');

function Lock(opts) {
  opts = opts || {};
  if (opts.lockerServer) {
    this.lock = new RemoteLock(opts.lockerServer.port, opts.lockerServer.host);

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

Lock.prototype.runLocked = function(token, cb, task) {
  $.shouldBeDefined(token);

  this.lock.locked(token, 2 * 1000, 10 * 60 * 1000, function(err, release) {
    if (err) return cb(new Error('Wallet is locked'));
    var _cb = function() {
      cb.apply(null, arguments);
      release();
    };
    task(_cb);
  });
};

module.exports = Lock;
