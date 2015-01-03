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

});
