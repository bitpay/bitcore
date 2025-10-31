'use strict';

import chai from 'chai';
import 'chai/register-should';
import sinon from 'sinon';
import { Utils } from '../src/lib/common/utils';
import { logger } from '../src/lib/logger';

const should = chai.should();

describe('Utils', function() {
  describe('#getMissingFields', function() {
    it('should check required fields', function() {
      const obj = {
        id: 'id',
        name: 'name',
        array: ['a', 'b'],
      };
      const fixtures = [{
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
      for (const f of fixtures) {
        Utils.getMissingFields(obj, f.args).should.deep.equal(f.check);
      }
    });
    it('should fail to check required fields on non-object', function() {
      const obj = 'dummy';
      Utils.getMissingFields(obj as any, 'name').should.deep.equal(['name']);
    });
  });

  describe('#hashMessage', function() {
    it('should create a hash', function() {
      const res = Utils.hashMessage('hola', false);
      res.toString('hex').should.equal('4102b8a140ec642feaa1c645345f714bc7132d4fd2f7f6202db8db305a96172f');
    });
  });

  describe('#verifyMessage', function() {
    afterEach(function() {
      sinon.restore();
    });
    it('should fail to verify a malformed signature', function() {
      const res = Utils.verifyMessage('hola', 'badsignature', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify a null signature', function() {
      const res = Utils.verifyMessage('hola', null, '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify with wrong pubkey', function() {
      const res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should call logger when _tryImportSignature throws', function() {
      const logSpy = sinon.spy(logger, 'error');
      const res = Utils.verifyMessage('hola', null, '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
      logSpy.called.should.equal(true);
      logSpy.calledOnceWith('_tryImportSignature encountered an error: %o').should.equal(true);
    });
    it('should call logger when _tryImportPublicKey throws', function() {
      const logSpy = sinon.spy(logger, 'error');
      const res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', null);
      should.exist(res);
      res.should.equal(false);
      logSpy.called.should.equal(true);
      logSpy.calledOnceWith('_tryImportPublicKey encountered an error: %o').should.equal(true);
    });
    it('should call logger when _tryVerifyMessage throws', function() {
      const logSpy = sinon.spy(logger, 'error');
      const fn = () => [];
      sinon.stub(Utils, '_tryImportSignature').callsFake(fn);
      sinon.stub(Utils, '_tryImportPublicKey').callsFake(fn);
      const res = Utils.verifyMessage('hola', [], []);
      should.exist(res);
      res.should.equal(false);
      logSpy.called.should.equal(true);
      logSpy.calledOnceWith('_tryVerifyMessage encountered an error: %o').should.equal(true);
    });
    it('should verify', function() {
      const res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f');
      should.exist(res);
      res.should.equal(true);
    });
    it('should verify paypro message', function() {
      const message = [
        '0xf868808475727b6b82dcc694a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844095ea7b300000000000000000000000034e158883efc81c5d92fde785fba48db738711ee0000000000000000000000000000000031333830363233333130303030303030018080',
        '0xf9014a018475727b6b830271009434e158883efc81c5d92fde785fba48db738711ee80b90124b6b4af0500000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000075727b6b0000000000000000000000000000000000000000000000000000000067d4f44bb6a77c3916143d6b6f47f77f4a2ccdaaebae426639a6971390892f47eaf362abc383935d052649b42e0b1c8b6429ba4901b1667e776eece5629bafc985bd3cab000000000000000000000000000000000000000000000000000000000000001cb93377d47517d20cc011ed69f9f31a91feafcea1c42d5c7a92c6a0aa5a1bc74175a3ed1beb148ffef9e289f6903489e227b303f7d3e4254e4eec6439ef4af518000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48018080',
      ];
      const sig = '304402201fd726ed086f2f025041cb6ee13e8145dd41c7ecccabbe6fba59d3da7dbec40e022058bc7c174050ed46a831802819478d04f4d71270e2a837b016d49e7b0727921f';
      const pubkey = {
        key: '03177c6fcf87bc2e13f61b199fd47fd43710d5cd5601d52487a16d9aad93262084',
        signature: '3045022100924c5c8396dc3a5c9e6fe28073d29876678bf6ff23eea70cc9499f75e23565550220166113dc785e4ade6aaba959f3f80eca3e667f91ef32fc82fcca7d27efecbb5e'
      };
      const res = Utils.verifyMessage(message, sig, pubkey.key);
      should.exist(res);
      res.should.equal(true);
    });
  });

  describe('#formatAmount', function() {
    it('should successfully format amount', function() {
      const cases: Array<{ args: [number, string, any?]; expected: string }> = [{
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
      }];

      for (const testCase of cases) {
        Utils.formatAmount(...testCase.args).should.equal(testCase.expected);
      }
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
      const res = Utils.translateAddress('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'bch');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should translate address from bch to btc', function() {
      const res = Utils.translateAddress('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'btc');
      res.should.equal('36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
    });

    it('should keep the address if there is nothing to do (bch)', function() {
      const res = Utils.translateAddress('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', 'bch');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should keep the address if there is nothing to do (btc)', function() {
      const res = Utils.translateAddress('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'btc');
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
      };

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if header x-forwarded-for exists and has more than one ip', function() {
      const req = {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12'
        }
      };

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if header x-real-ip exists', function() {
      const req = {
        headers: {
          'x-real-ip': '1.2.3.4'
        }
      };

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if header x-real-ip exists and has more than one ip', function() {
      const req = {
        headers: {
          'x-real-ip': '1.2.3.4, 5.6.7.8, 9.10.11.12'
        }
      };

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if req.ip exists', function() {
      const req = {
        ip: '1.2.3.4'
      };

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get the ip if req.connection.remoteAddress exists', function() {
      const req = {
        connection: {
          remoteAddress: '1.2.3.4'
        }
      };

      const ip = Utils.getIpFromReq(req);
      should.exist(ip);
      ip.should.equal('1.2.3.4');
    });

    it('should get an empty string if no case is met', function() {
      const req = {};

      const ip = Utils.getIpFromReq(req);
      ip.should.equal('');
    });
  });

  describe('#sortAsc', function() {
    it('should sort a simple array', function() {
      const res = Utils.sortAsc([3, 1, 2]);
      res.should.deep.equal([1, 2, 3]);
    });

    it('should sort a simple array with undefined values', function() {
      const res = Utils.sortAsc([3, undefined, 1, 2, '\uFFFE']);
      res.should.deep.equal([1, 2, 3, '\uFFFE', undefined]); // undefined should be in last position
    });

    it('should sort a simple array with bool values', function() {
      const res = Utils.sortAsc([3, true, 1, true, 2, false]);
      res.should.deep.equal([false, true, 1, true, 2, 3]); // false is considered as 0, true as 1
    });

    it('should sort a simple array with NaN values', function() {
      const res = Utils.sortAsc([3, NaN, 1, 2]);
      res.should.deep.equal([NaN, 1, 2, 3]); // NaN should be considered 0
    });

    it('should sort a simple array with null values', function() {
      const res = Utils.sortAsc([3, 1, null, 2, 0, null]);
      res.should.deep.equal([null, 0, null, 1, 2, 3]); // null is considered as 0
    });

    it('should sort an array of objects', function() {
      const res = Utils.sortAsc([{ a: 3 }, { a: 1 }, { a: 2 }], 'a');
      res.should.deep.equal([
        { a: 1 },
        { a: 2 },
        { a: 3 }
      ]);
    });

    it('should sort an array of objects with priority', function() {
      const res = Utils.sortAsc([{ a: 2, b: 2 }, { a: 1, b: 3 }, { a: 2, b: 1 }], 'a', 'b');
      res.should.deep.equal([
        { a: 1, b: 3 },
        { a: 2, b: 1 },
        { a: 2, b: 2 }
      ]);
    });

    it('should sort an array of objects with nested key', function() {
      const res = Utils.sortAsc([{ a: { b: 3 } }, { a: { b: 1 } }, { a: { b: 2 } }], ['a', 'b']);
      res.should.deep.equal([
        { a: { b: 1 } },
        { a: { b: 2 } },
        { a: { b: 3 } }
      ]);
    });
  });

  describe('#difference', function() {
    it('should return the diff', function() {
      const res = Utils.difference([1, 2, 3], [1, 3, 4]);
      res.should.deep.equal([2]);
    });

    it('should return copy of arr1 if arr2 is not given', function() {
      const arr1 = [1, 2, 3];
      const res = Utils.difference([1, 2, 3], undefined);
      res.should.deep.equal([1, 2, 3]);
      (arr1 === res).should.be.false;
    });

    it('should return empty array if arr1 is not given', function() {
      const res = Utils.difference(undefined, [1, 2, 3]);
      res.should.deep.equal([]);
    });

    it('should return empty array if no params given', function() {
      const res = Utils.difference(undefined, undefined);
      res.should.deep.equal([]);
    });

    it('should return empty array if arr1 non-array is given', function() {
      const res = Utils.difference(1, undefined);
      res.should.deep.equal([]);
    });

    it('should return all arr1 elemnts if arr2 non-array is given', function() {
      const res = Utils.difference([1, 2, 3], 1);
      res.should.deep.equal([1, 2, 3]);
    });

    it('should return all arr1 elemnts if arr2 non-array is given', function() {
      const res = Utils.difference([1, 2, 3], 1);
      res.should.deep.equal([1, 2, 3]);
    });
  });
});
