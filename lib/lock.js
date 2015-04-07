var $ = require('preconditions').singleton();
var _ = require('lodash');
var LocalLock = require('./locallock');
var RemoteLock = require('locker');

function Lock(opts) {};

Lock.prototype.runLocked = function(token, cb, task) {
  $.shouldBeDefined(token);

  LocalLock.get(token, function(lock) {
    var _cb = function() {
      cb.apply(null, arguments);
      lock.free();
    };
    task(_cb);
  });
};

module.exports = Lock;
