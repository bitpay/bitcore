'use strict';

var should = require('chai').should();
var dogecore = require('../');

describe('#versionGuard', function() {
  it('global._dogecore should be defined', function() {
    should.equal(global._dogecore, dogecore.version);
  });

  it('throw an error if version is already defined', function() {
    (function() {
      dogecore.versionGuard('version');
    }).should.throw('More than one instance of dogecore');
  });
});
