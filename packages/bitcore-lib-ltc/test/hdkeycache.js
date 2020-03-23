'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var bitcore = require('..');
var HDPrivateKey = bitcore.HDPrivateKey;

var xprivkey = 'Ltpv71G8qDifUiNetP6nmxPA5STrUVmv2J9YSmXajv8VsYBUyuPhvN9xCaQrfX2wo5xxJNtEazYCFRUu5FmokYMM79pcqz8pcdo4rNXAFPgyB4k';

describe('HDKey cache', function() {
  this.timeout(10000);

  /* jshint unused: false */
  var cache = bitcore._HDKeyCache;
  var master = new HDPrivateKey(xprivkey);

  beforeEach(function() {
    cache._cache = {};
    cache._count = 0;
    cache._eraseIndex = 0;
    cache._usedIndex = {};
    cache._usedList = {};
    cache._CACHE_SIZE = 3; // Reduce for quick testing
  });

  it('saves a derived key', function() {
    var child = master.derive(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child.xprivkey);
  });
  it('starts erasing unused keys', function() {
    var child1 = master.derive(0);
    var child2 = child1.derive(0);
    var child3 = child2.derive(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child1.xprivkey);
    var child4 = child3.derive(0);
    expect(cache._cache[master.xprivkey + '/0/false']).to.equal(undefined);
  });
  it('avoids erasing keys that get cache hits ("hot keys")', function() {
    var child1 = master.derive(0);
    var child2 = master.derive(0).derive(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child1.xprivkey);
    var child1_copy = master.derive(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child1.xprivkey);
  });
  it('keeps the size of the cache small', function() {
    var child1 = master.derive(0);
    var child2 = child1.derive(0);
    var child3 = child2.derive(0);
    var child4 = child3.derive(0);
    expect(_.size(cache._cache)).to.equal(3);
  });
});
