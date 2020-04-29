'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { Advertisement } = require('../../ts_build/lib/model/advertisement');
var Bitcore = require('bitcore-lib');

describe("#Advertisement", function() {
  describe("#create", function() {
    it("should create Advertisement", function() {
      var x = Advertisement.create({ title: "Test Title"});

      should.exist(x);
    });
  });

  describe("#fromObj", function() {
    // not yet implemented
  });
});