'use strict';

module.exports = {
  _cache: {},
  _count: 0,
  _eraseIndex: 0,
  _usedList: {},
  _usedIndex: {},
  _CACHE_SIZE: 5000,

  get: function(xkey, number, hardened) {
    hardened = !!hardened;
    var key = xkey + '/' + number + '/' + hardened;
    if (this._cache[key]) {
      this._cacheHit(key);
      return this._cache[key];
    }
  },
  set: function(xkey, number, hardened, derived) {
    hardened = !!hardened;
    var key = xkey + '/' + number + '/' + hardened;
    this._cache[key] = derived;
    this._cacheHit(key);
  },
  _cacheHit: function(key) {
    if (this._usedIndex[key]) {
      delete this._usedList[this._usedIndex[key]];
    }
    this._usedList[this._count] = key;
    this._usedIndex[key] = this._count;
    this._count++;
    this._cacheRemove();
  },
  _cacheRemove: function() {
    while (this._eraseIndex < this._count - this._CACHE_SIZE) {
      if (this._usedList[this._eraseIndex]) {
        var removeKey = this._usedList[this._eraseIndex];
        delete this._usedIndex[removeKey];
        delete this._cache[removeKey];
      }
      delete this._usedList[this._eraseIndex];
      this._eraseIndex++;
    }
  }
};
