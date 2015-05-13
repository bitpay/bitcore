'use strict';

var expect = require('chai').expect;
var bitcore = require('../');

// current tests works only in node.js
var bdescribe = typeof window === 'undefined' ? describe : xdescribe
bdescribe('index.js', function() {
  var bitcoreModulePath;
  var bitcoreModule;

  before(function() {
    bitcoreModulePath = require.resolve('../');
    bitcoreModule = require.cache[bitcoreModulePath];
    delete require.cache[bitcoreModulePath];
  });

  after(function() {
    require.cache[bitcoreModulePath] = bitcoreModule;
  });

  function importBitcore() {
    require('../');
  }

  it('global._bitcore should be defined', function() {
    expect(global._bitcore).to.equal(bitcore.version);
  });

  it('throw error on importing other bitcore module', function() {
    expect(importBitcore).to.throw(Error);
  });

  it('throw error on importing with defined window', function () {
    global.window = 'window hack';
    expect(importBitcore).to.throw(Error);
    delete global.window;
  });
});
