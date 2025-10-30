'use strict';

import chai from 'chai';
import { BitcoreLib as Bitcore } from 'crypto-wallet-core';
import { Utils } from '../src/lib/common';

const should = chai.should();

describe('Utils', () => {

  describe('#hashMessage', () => {
    it('should create a hash', () => {
      const res = Utils.hashMessage('hola');
      res.toString('hex').should.equal('4102b8a140ec642feaa1c645345f714bc7132d4fd2f7f6202db8db305a96172f');
    });
  });

  describe('#xPubToCopayerId', () => {
    const xpub = 'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj';
    
    it('should generate copayerId BTC', () => {
      const res = Utils.xPubToCopayerId('btc', xpub);
      res.should.equal('af4e120530f26ffa834739b0eb030093c881bf73f8f893fc6837823325da83f2');
    });

    it('should generate copayerId BCH', () => {
      const res = Utils.xPubToCopayerId('bch', xpub);
      res.should.equal('ec63517dba84344ac3d4cfb59ad99f49333272200defc0cad93733db833cf9a1');
    });
  });

  describe('#signMessage', () => {
    it('should sign a message', () => {
      const sig = Utils.signMessage('hola', '09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c');
      should.exist(sig);
      sig.should.equal('3045022100f2e3369dd4813d4d42aa2ed74b5cf8e364a8fa13d43ec541e4bc29525e0564c302205b37a7d1ca73f684f91256806cdad4b320b4ed3000bee2e388bcec106e0280e0');
    });
    it('should fail to sign with wrong args', () => {
      (() => {
        Utils.signMessage('hola', '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f');
      }).should.throw('Number');
    });
  });

  describe('#verifyMessage', () => {
    it('should fail to verify a malformed signature', () => {
      const res = Utils.verifyMessage('hola', 'badsignature', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify a null signature', () => {
      const res = Utils.verifyMessage('hola', null, '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify with wrong pubkey', () => {
      const res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should verify', () => {
      const res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f');
      should.exist(res);
      res.should.equal(true);
    });
  });

  describe('#formatAmount', () => {
    it('should successfully format short amount', () => {
      const cases = [{
        args: [1, 'bit'],
        expected: '0',
      }, {
        args: [1, 'btc'],
        expected: '0.00',
      }, {
        args: [400050000, 'btc'],
        expected: '4.0005',
      }, {
        args: [400000000, 'btc'],
        expected: '4.00',
      }, {
        args: [49999, 'btc'],
        expected: '0.000499',
      }, {
        args: [100000000, 'btc'],
        expected: '1.00',
      }, {
        args: [0, 'bit'],
        expected: '0',
      }, {
        args: [12345678, 'bit'],
        expected: '123,456',
      }, {
        args: [12345678, 'btc'],
        expected: '0.123456',
      }, {
        args: [12345611, 'btc'],
        expected: '0.123456',
      }, {
        args: [1234, 'btc'],
        expected: '0.000012',
      }, {
        args: [1299, 'btc'],
        expected: '0.000012',
      }, {
        args: [1234567899999, 'btc'],
        expected: '12,345.678999',
      }, {
        args: [12345678, 'bit', {
          thousandsSeparator: '.'
        }],
        expected: '123.456',
      }, {
        args: [12345678, 'btc', {
          decimalSeparator: ','
        }],
        expected: '0,123456',
      }, {
        args: [1234567899999, 'btc', {
          thousandsSeparator: ' ',
          decimalSeparator: ','
        }],
        expected: '12 345,678999',
      }, {
        args: [104236872411, 'eth'],
        expected: '0.00',
      }, {
        args: [104236872412, 'eth'],
        expected: '0.00',
      }

      ];

      for (const testCase of cases) {
        Utils.formatAmount(testCase.args[0], testCase.args[1], testCase.args[2]).should.equal(testCase.expected);
      }
    });
    it('should successfully format full amount', () => {
      const cases = [{
        args: [1, 'bit'],
        expected: '0.01',
      }, {
        args: [1, 'btc'],
        expected: '0.00000001',
      }, {
        args: [0, 'bit'],
        expected: '0.00',
      }, {
        args: [12345678, 'bit'],
        expected: '123,456.78',
      }, {
        args: [12345678, 'btc'],
        expected: '0.12345678',
      }, {
        args: [1234567, 'btc'],
        expected: '0.01234567',
      }, {
        args: [12345611, 'btc'],
        expected: '0.12345611',
      }, {
        args: [1234, 'btc'],
        expected: '0.00001234',
      }, {
        args: [1299, 'btc'],
        expected: '0.00001299',
      }, {
        args: [1234567899999, 'btc'],
        expected: '12,345.67899999',
      }, {
        args: [12345678, 'bit', {
          thousandsSeparator: "'"
        }],
        expected: "123'456.78",
      }, {
        args: [12345678, 'btc', {
          decimalSeparator: ','
        }],
        expected: '0,12345678',
      }, {
        args: [1234567899999, 'btc', {
          thousandsSeparator: ' ',
          decimalSeparator: ','
        }],
        expected: '12 345,67899999',
      }, {
          args: [104236872412, 'eth'],
          expected: '0.00000010',
        }
      ];

      for (const testCase of cases) {
        const opts = testCase.args[2] || {} as any;
        opts.fullPrecision = true;
        Utils.formatAmount(testCase.args[0], testCase.args[1], opts).should.equal(testCase.expected);
      }
    });
  });

  describe('#signMessage #verifyMessage round trip', () => {
    it('should sign and verify', () => {
      const msg = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
      const sig = Utils.signMessage(msg, '09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c');
      Utils.verifyMessage(msg, sig, '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f').should.equal(true);
    });
  });

  describe('#encryptMessage #decryptMessage round trip', () => {
    it('should encrypt and decrypt', () => {
      const pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      const ct = Utils.encryptMessage('hello world', pwd);
      const msg = Utils.decryptMessage(ct, pwd);
      msg.should.equal('hello world');
    });
  });


  describe('#decryptMessage should throw', () => {
    it('should encrypt and decrypt', () => {
      const pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      const ct = Utils.encryptMessage('hello world', pwd);
      (() => {
        Utils.decryptMessage(ct, 'test')
      }).should.throw('Invalid key length');
    });
  });

  describe('#decryptMessageNoThrow should not throw', () => {
    it('should encrypt and decrypt', () => {
      const pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      const ct = Utils.encryptMessage('hello world', pwd);
      const msg = Utils.decryptMessageNoThrow(ct, pwd);

      msg.should.equal('hello world');
    });

    it('should encrypt and  fail to decrypt', () => {
      const pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      const ct = Utils.encryptMessage('hello world', pwd);
      const msg = Utils.decryptMessageNoThrow(ct, 'hola');

      msg.should.equal('<ECANNOTDECRYPT>');
    });


    it('should failover to decrypt a non-encrypted msg', () => {
      const pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      const msg = Utils.decryptMessageNoThrow('hola mundo', 'hola');

      msg.should.equal('hola mundo');
    });

    it('should failover to decrypt a non-encrypted msg (case 2)', () => {
      const pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      const msg = Utils.decryptMessageNoThrow('{"pepe":1}', 'hola');

      msg.should.equal('{"pepe":1}');
    });


    it('should no try to decrypt empty', () => {
      const msg = Utils.decryptMessageNoThrow('', 'hola');
      msg.should.equal('');
    });


    it('should no try to decrypt null', () => {
      const msg = Utils.decryptMessageNoThrow(null, 'hola');
      msg.should.equal('');
    });


  });



  describe('#getProposalHash', () => {
    it('should compute hash for old style proposals', () => {
      const hash = Utils.getProposalHash('msj42CCGruhRsFrGATiUuh25dtxYtnpbTx', 1234, 'the message');
      hash.should.equal('msj42CCGruhRsFrGATiUuh25dtxYtnpbTx|1234|the message|');
    });
    it('should compute hash for arbitrary proposal', () => {
      const header1 = {
        type: 'simple',
        version: '1.0',
        toAddress: 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx',
        amount: 1234,
        message: {
          one: 'one',
          two: 'two'
        },
      };

      const header2 = {
        toAddress: 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx',
        type: 'simple',
        version: '1.0',
        message: {
          two: 'two',
          one: 'one'
        },
        amount: 1234,
      };

      const hash1 = Utils.getProposalHash(header1);
      const hash2 = Utils.getProposalHash(header2);

      hash1.should.equal(hash2);
    });
  });

  describe('#privateKeyToAESKey', () => {
    it('should be ok', () => {
      const privKey = new Bitcore.PrivateKey('09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c').toString();
      Utils.privateKeyToAESKey(privKey).should.be.equal('2HvmUYBSD0gXLea6z0n7EQ==');
    });
    it('should fail if pk has invalid values', () => {
      const values = [
        null,
        123,
        'x123',
      ];
      for (const value of values) {
        let valid = true;
        try {
          Utils.privateKeyToAESKey(value);
        } catch (e) {
          valid = false;
        }
        valid.should.be.false;
      }
    });
  });

  describe('#verifyRequestPubKey', () => {
    it('should generate and check request pub key', () => {
      const reqPubKey = (new Bitcore.PrivateKey).toPublicKey();
      const xPrivKey = new Bitcore.HDPrivateKey();
      const xPubKey = new Bitcore.HDPublicKey(xPrivKey);


      const sig = Utils.signRequestPubKey(reqPubKey.toString(), xPrivKey);
      const valid = Utils.verifyRequestPubKey(reqPubKey.toString(), sig, xPubKey);
      valid.should.be.equal(true);
    });

    it('should fail to check a request pub key with wrong key', () => {
      const reqPubKey = '02c2c1c6e75cfc50235ff4a2eb848385c2871b8c94e285ee82eaced1dcd5dd568e';
      const xPrivKey = new Bitcore.HDPrivateKey();
      const xPubKey = new Bitcore.HDPublicKey(xPrivKey);
      const sig = Utils.signRequestPubKey(reqPubKey, xPrivKey);

      const xPrivKey2 = new Bitcore.HDPrivateKey();
      const xPubKey2 = new Bitcore.HDPublicKey(xPrivKey2);
      const valid = Utils.verifyRequestPubKey(reqPubKey, sig, xPubKey2);
      valid.should.be.equal(false);
    });
  });
});
