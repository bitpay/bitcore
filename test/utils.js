'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();

var Utils = require('../lib/utils');

describe('Utils', function() {
  describe('#formatAmount', function() {
    it('should successfully format amount', function() {
      var cases = [{
        args: [1, 'bit', 'en'],
        expected: '0',
      }, {
        args: [1, 'btc', 'en'],
        expected: '0.000000',
      }, {
        args: [0, 'bit', 'en'],
        expected: '0',
      }, {
        args: [12345678, 'bit', 'en'],
        expected: '123,457',
      }, {
        args: [12345678, 'btc', 'en'],
        expected: '0.123457',
      }, {
        args: [12345611, 'btc', 'en'],
        expected: '0.123456',
      }, {
        args: [1234567899999, 'btc', 'en'],
        expected: '12,345.679000',
      }, {
        args: [12345678, 'bit', 'es'],
        expected: '123.457',
      }, {
        args: [12345678, 'btc', 'es'],
        expected: '0,123457',
      }, {
        args: [1234567899999, 'btc', 'es'],
        expected: '12.345,679000',
      }, ];

      _.each(cases, function(testCase) {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
  });
});
