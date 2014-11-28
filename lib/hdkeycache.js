'use strict';

var cache = {};

module.exports = {
  get: function(xkey, number, hardened) {
    var key = xkey + '/' + number + '/' + hardened;
    if (cache[key]) {
      return cache[key];
    }
  },
  set: function(xkey, number, hardened, derived) {
    var key = xkey + '/' + number + '/' + hardened;
    cache[key] = derived;
  }
};
