"use strict";

var should = require("chai").should();
var widecore = require("../");

describe('#versionGuard', function() {
  it('global._widecore should be defined', function() {
    should.equal(global._widecore, widecore.version);
  });

  it('throw an error if version is already defined', function() {
    (function() {
      widecore.versionGuard('version');
    }).should.throw('More than one instance of widecore');
  });
});
