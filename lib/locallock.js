var _ = require('lodash');
var $ = require('preconditions').singleton();
var locks = {};

function Lock() {

};

Lock.prototype._runOne = function(token) {
  var self = this;

  if (locks[token].length == 0) return;

  var task = locks[token][0];

  task(null, function() {
    locks[token].shift();
    self._runOne(token);
  });
};

Lock.prototype.locked = function(token, wait, max, task) {
  if (_.isUndefined(locks[token])) {
    locks[token] = [];
  }

  locks[token].push(task);

  if (locks[token].length == 1) {
    this._runOne(token);
  }
};

module.exports = Lock;
