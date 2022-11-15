'use strict';

var should = require('chai').should();
var litecore = require('../');

describe('#versionGuard', function() {
  it('global._litecore should be defined', function() {
    should.equal(global._litecore, litecore.version);
  });

  it('throw an error if version is already defined', function() {
    (function() {
      litecore.versionGuard('version');
    }).should.throw('More than one instance of litecore');
  });
});
