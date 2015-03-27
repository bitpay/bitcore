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
        args: [1, 'bit'],
        expected: '0',
      }, {
        args: [1, 'btc'],
        expected: '0.000000',
      }, {
        args: [0, 'bit'],
        expected: '0',
      }, {
        args: [12345678, 'bit'],
        expected: '123,457',
      }, {
        args: [12345678, 'btc'],
        expected: '0.123457',
      }, {
        args: [12345611, 'btc'],
        expected: '0.123456',
      }, {
        args: [1234567899999, 'btc'],
        expected: '12,345.679000',
      }, {
        args: [12345678, 'bit', {
          thousandsSeparator: '.'
        }],
        expected: '123.457',
      }, {
        args: [12345678, 'btc', {
          decimalSeparator: ','
        }],
        expected: '0,123457',
      }, {
        args: [1234567899999, 'btc', {
          thousandsSeparator: ' ',
          decimalSeparator: ','
        }],
        expected: '12 345,679000',
      }, ];

      _.each(cases, function(testCase) {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
  });
});
