'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Utils = require('../lib/common/utils');

describe('Utils', function() {
  describe('#getMissingFields', function() {
    it('should check required fields', function() {
      var obj = {
        id: 'id',
        name: 'name',
        array: ['a', 'b'],
      };
      var fixtures = [{
        args: 'id',
        check: [],
      }, {
        args: ['id'],
        check: []
      }, {
        args: ['id, name'],
        check: ['id, name'],
      }, {
        args: ['id', 'name'],
        check: []
      }, {
        args: 'array',
        check: []
      }, {
        args: 'dummy',
        check: ['dummy']
      }, {
        args: ['dummy1', 'dummy2'],
        check: ['dummy1', 'dummy2']
      }, {
        args: ['id', 'dummy'],
        check: ['dummy']
      }, ];
      _.each(fixtures, function(f) {
        Utils.getMissingFields(obj, f.args).should.deep.equal(f.check);
      });
    });
    it('should fail to check required fields on non-object', function() {
      var obj = 'dummy';
      Utils.getMissingFields(obj, 'name').should.deep.equal(['name']);
    });
  });

  describe('#hashMessage', function() {
    it('should create a hash', function() {
      var res = Utils.hashMessage('hola');
      res.toString('hex').should.equal('4102b8a140ec642feaa1c645345f714bc7132d4fd2f7f6202db8db305a96172f');
    });
  });

  describe('#verifyMessage', function() {
    it('should fail to verify a malformed signature', function() {
      var res = Utils.verifyMessage('hola', 'badsignature', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify a null signature', function() {
      var res = Utils.verifyMessage('hola', null, '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify with wrong pubkey', function() {
      var res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should verify', function() {
      var res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f');
      should.exist(res);
      res.should.equal(true);
    });
  });

  describe('#formatAmount', function() {
    it('should successfully format amount', function() {
      var cases = [{
        args: [1, 'bit'],
        expected: '0',
      }, {
        args: [1, 'btc'],
        expected: '0.00',
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
        args: [1234, 'btc'],
        expected: '0.000012',
      }, {
        args: [1299, 'btc'],
        expected: '0.000013',
      }, {
        args: [1234567899999, 'btc'],
        expected: '12,345.679',
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
        expected: '12 345,679',
      }, ];

      _.each(cases, function(testCase) {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
  });
});
