'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var CliUtils = require('../bin/cli-utils');

describe('CliUtils', function() {
  describe('#parseMN', function() {
    it('should successfully parse m & n', function() {
      var texts = {
        '1-1': [1, 1],
        '1-of-1': [1, 1],
        '1of1': [1, 1],
        '1-OF-2': [1, 2],
        '1OF2': [1, 2],
        ' 2-2': [2, 2],
        '2-3 ': [2, 3],
        '10-10': [10, 10],
        '10-of-10': [10, 10],
      };
      _.each(texts, function(expected, text) {
        var result = CliUtils.parseMN(text);
        result.should.deep.equal(expected);
      });
    });
    it('should fail to parse incorrect m & n', function() {
      var texts = [
        '',
        ' ',
        '1',
        'x-1',
        '1-x',
        'of-1-1',
        '2-2-of',
        '1-1-1',
        ' 1_1 ',
        '2-1',
        '2-of-1',
        '-1-2',
        '1--2',
        'x-of-2',
      ];
      _.each(texts, function(text) {
        var valid = true;
        try {
          CliUtils.parseMN(text);
        } catch (e) {
          valid = false;
        }
        valid.should.be.false;
      });
    });
  });

  describe('#parseAmount', function() {
    it('should successfully parse amounts', function() {
      var texts = {
        '1': 1,
        '0': 0,
        '1.': 1,
        '000000.0000': 0,
        '123': 123,
        '123sat': 123,
        '123 sat': 123,
        '00123 sat': 123,
        '1.23bit': 123,
        '1.23 bit': 123,
        '0 bit': 0,
        '.45bit': 45,
        '1btc': 100000000,
        '  1btc': 100000000,
        '9999btc': 999900000000,
        '0.00000001btc': 1,
        '00000.00000001BTC': 1,
        '0.00000001 BTC': 1,
        '0.123btc': 12300000,
        '0.123   bTc': 12300000,
      };
      _.each(texts, function(satoshi, text) {
        var amount = CliUtils.parseAmount(text);
        amount.should.equal(satoshi);
      });
    });
    it('should fail to parse incorrect amounts', function() {
      var texts = [
        '',
        '  ',
        'btc',
        '1satoshi',
        'no-number',
        '-3',
        '1 b t c',
        'btc1',
        'btc 1',
        '1,234',
        '0.000000001btc',
        '0.1sat',
        '0.123bit',
        '2.000000009btc',
      ];
      _.each(texts, function(text) {
        var valid = true;
        try {
          CliUtils.parseAmount(text);
        } catch (e) {
          valid = false;
        }
        valid.should.be.false;
      });
    });
  });
});
