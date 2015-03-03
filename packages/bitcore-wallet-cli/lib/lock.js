var _ = require('lodash');

var locks = {};

var Lock = function () {
  this.taken = false;
  this.queue = [];
};

Lock.prototype.free = function () {
  if (this.queue.length > 0) {
    var f = this.queue.shift();
    f(this);
  } else {
    this.taken = false;
  }
};

Lock.get = function (key, callback) {
  if (_.isUndefined(locks[key])) {
    locks[key] = new Lock();
  }
  var lock = locks[key];

  if (lock.taken) {
    lock.queue.push(callback);
  } else {
    lock.taken = true;
    callback(lock);
  }
};

module.exports = Lock;
