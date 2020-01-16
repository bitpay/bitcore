'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Utils = require('../ts_build/lib/common/utils');

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
      },];
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
        args: [1299, 'bch'],
        expected: '0.000013',
      }, {
        args: [12940, 'bch'],
        expected: '0.000129',
      }, {
        args: [12960, 'bch'],
        expected: '0.00013',
      }, {
        args: [129900000, 'bch'],
        expected: '1.299',
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
      },];

      _.each(cases, function(testCase) {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
  });

  describe('#getAddressCoin', function() {
    it('should identify btc as coin for 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', function() {
      Utils.getAddressCoin('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA').should.equal('btc');
    });
    it('should identify bch as coin for CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', function() {
      Utils.getAddressCoin('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz').should.equal('bch');
    });
    it('should return null for 1L', function() {
      should.not.exist(Utils.getAddressCoin('1L'));
    });
  });

  describe('#parseVersion', function() {
    it('should parse version', function() {
      Utils.parseVersion('bwc-2.3.1').should.deep.equal({
        agent: 'bwc',
        major: 2,
        minor: 3,
        patch: 1,
      });
    });
    it('should parse version case 2', function() {
      Utils.parseVersion('xxss').should.deep.equal({
        agent: 'xxss',
      });
    });
    it('should parse version case 3', function() {
      Utils.parseVersion('xxss-32').should.deep.equal({
        agent: 'xxss',
        major: 32,
        minor: null,
        patch: null,
      });
    });


  });

  describe('#parseAppVersion', function() {
    it('should parse user version', function() {
      Utils.parseAppVersion('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Copay/5.2.2 Chrome/66.0.3359.181 Electron/3.0.8 Safari/537.36').should.deep.equal({
        app: 'copay',
        major: 5,
        minor: 2,
        patch: 2,
      });
    });
    it('should parse version case 2', function() {
      Utils.parseAppVersion('bitpay 5.2.2 (Android 8.0.0 - SM-N950U)').should.deep.equal({
        app: 'bitpay',
        major: 5,
        minor: 2,
        patch: 2,
      });
    });
    it('should parse version case 3', function() {
      Utils.parseAppVersion('bitpay 5.2.2 (iOS 12.0 - iPhone9,2)').should.deep.equal({
        app: 'bitpay',
        major: 5,
        minor: 2,
        patch: 2,
      });
    });
    it('should parse version case 4', function() {
      Utils.parseAppVersion('node-superagent/3.8.3').should.deep.equal({
        app: 'other',
      });
    });

  });


  describe('#translateAddress', function() {
    it('should translate address from btc to bch', function() {
      var res = Utils.translateAddress('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'bch');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should translate address from bch to btc', function() {
      var res = Utils.translateAddress('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'btc');
      res.should.equal('36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
    });

    it('should keep the address if there is nothing to do (bch)', function() {
      var res = Utils.translateAddress('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', 'bch');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should keep the address if there is nothing to do (btc)', function() {
      var res = Utils.translateAddress('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'btc');
      should.exist(res);
      res.should.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
    });
  });

  describe('#getIpFromReq', () => {
    it('should get the ip if header x-forwarded-for exists', function() {
      const req = {
        headers: {
          'x-forwarded-for': '1.2.3.4'
        }
      }

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if header x-forwarded-for exists and has more than one ip', function() {
      const req = {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12'
        }
      }

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if header x-real-ip exists', function() {
      const req = {
        headers: {
          'x-real-ip': '1.2.3.4'
        }
      }

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if header x-real-ip exists and has more than one ip', function() {
      const req = {
        headers: {
          'x-real-ip': '1.2.3.4, 5.6.7.8, 9.10.11.12'
        }
      }

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if req.ip exists', function() {
      const req = {
        ip: '1.2.3.4'
      }

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if req.connection.remoteAddress exists', function() {
      const req = {
        connection: {
          remoteAddress: '1.2.3.4'
        }
      }

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get an empty string if no case is met', function() {
      const req = {}

      const ip = Utils.getIpFromReq(req);
      ip.should.equal('');
    });
  });



});
