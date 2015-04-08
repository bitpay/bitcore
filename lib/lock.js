var $ = require('preconditions').singleton();
var _ = require('lodash');
var LocalLock = require('./locallock');
var RemoteLock = require('locker');

function Lock(opts) {
  this.lock = new LocalLock();
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
