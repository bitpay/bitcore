'use strict';

var _ = require('lodash');
var expect = require('chai').expect;
var bitcore = require('..');
var HDPrivateKey = bitcore.HDPrivateKey;

var xprivkey = 'xprv9s21ZrQH143K2tec3punnxbVaxde2M5MAHHpkLBC15LhxFoX5v8BP27hYoGfrVvu2QVDbAQYT4DbQd3AjT94EHDgCZCLo17p4SwgwwPCjPG';

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
    var child = master.deriveChild(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child.xprivkey);
  });
  it('starts erasing unused keys', function() {
    var child1 = master.deriveChild(0);
    var child2 = child1.deriveChild(0);
    var child3 = child2.deriveChild(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child1.xprivkey);
    var child4 = child3.deriveChild(0);
    expect(cache._cache[master.xprivkey + '/0/false']).to.equal(undefined);
  });
  it('avoids erasing keys that get cache hits ("hot keys")', function() {
    var child1 = master.deriveChild(0);
    var child2 = master.deriveChild(0).deriveChild(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child1.xprivkey);
    var child1_copy = master.deriveChild(0);
    expect(cache._cache[master.xprivkey + '/0/false'].xprivkey).to.equal(child1.xprivkey);
  });
  it('keeps the size of the cache small', function() {
    var child1 = master.deriveChild(0);
    var child2 = child1.deriveChild(0);
    var child3 = child2.deriveChild(0);
    var child4 = child3.deriveChild(0);
    expect(_.size(cache._cache)).to.equal(3);
  });
});
