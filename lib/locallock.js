var _ = require('lodash');
var $ = require('preconditions').singleton();
var locks = {};

function Lock() {

};

Lock.prototype._runOne = function(token) {
  var self = this;

  var item = _.first(locks[token]);
  if (!item || item.started) return;

  item.started = true;
  if (item.maxRunningTime > 0) {
    setTimeout(function() {
      var it = _.first(locks[token]);
      if (it != item) return;
      locks[token].shift();
      self._runOne(token);
    }, item.maxRunningTime);
  }

  item.fn(null, function() {
    locks[token].shift();
    self._runOne(token);
  });
};

Lock.prototype.locked = function(token, wait, max, task) {
  var self = this;

  if (_.isUndefined(locks[token])) {
    locks[token] = [];
  }

  var item = {
    maxRunningTime: max,
    started: false,
    fn: task,
  };
  locks[token].push(item);

  if (wait > 0) {
    setTimeout(function() {
      var it = _.find(locks[token], item);
      if (!it || it.started) return;
      locks[token] = _.without(locks[token], it);
      it.fn(new Error('Could not acquire lock ' + token));
    }, wait);
  }
  self._runOne(token);
};

module.exports = Lock;
