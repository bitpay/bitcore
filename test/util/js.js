'use strict';
/* jshint unused: false */

var should = require('chai').should();
var expect = require('chai').expect;

var bitcore = require('../..');
var JSUtil = bitcore.util.js;

describe('js utils', function() {

  describe('isValidJSON', function() {

    var hexa = '8080808080808080808080808080808080808080808080808080808080808080';
    var json = '{"key": ["value", "value2"]}';
    var json2 = '["value", "value2", {"key": "value"}]';

    it('does not mistake an integer as valid json object', function() {
      var valid = JSUtil.isValidJSON(hexa);
      valid.should.equal(false);
    });

    it('correctly validates a json object', function() {
      var valid = JSUtil.isValidJSON(json);
      valid.should.equal(true);
    });

    it('correctly validates an array json object', function() {
      var valid = JSUtil.isValidJSON(json);
      valid.should.equal(true);
    });

  });

  describe('isNaturalNumber', function() {
    it('false for float', function() {
      var a = JSUtil.isNaturalNumber(0.1);
      a.should.equal(false);
    });

    it('false for string float', function() {
      var a = JSUtil.isNaturalNumber('0.1');
      a.should.equal(false);
    });

    it('false for string integer', function() {
      var a = JSUtil.isNaturalNumber('1');
      a.should.equal(false);
    });

    it('false for negative integer', function() {
      var a = JSUtil.isNaturalNumber(-1);
      a.should.equal(false);
    });

    it('false for negative integer string', function() {
      var a = JSUtil.isNaturalNumber('-1');
      a.should.equal(false);
    });

    it('false for infinity', function() {
      var a = JSUtil.isNaturalNumber(Infinity);
      a.should.equal(false);
    });

    it('false for NaN', function() {
      var a = JSUtil.isNaturalNumber(NaN);
      a.should.equal(false);
    });

    it('true for zero', function() {
      var a = JSUtil.isNaturalNumber(0);
      a.should.equal(true);
    });

    it('true for positive integer', function() {
      var a = JSUtil.isNaturalNumber(1000);
      a.should.equal(true);
    });

  });

});
