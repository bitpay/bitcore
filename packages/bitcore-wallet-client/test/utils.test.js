'use strict';

var _ = require('lodash');
var chai = require('chai');
var should = chai.should();
var Bitcore = require('crypto-wallet-core').BitcoreLib;
var { Utils } = require('../ts_build/lib/common');

describe('Utils', () => {

  describe('#hashMessage', () => {
    it('should create a hash', () => {
      var res = Utils.hashMessage('hola');
      res.toString('hex').should.equal('4102b8a140ec642feaa1c645345f714bc7132d4fd2f7f6202db8db305a96172f');
    });
  });

  describe('#xPubToCopayerId', () => {
    it('should generate copayerId BTC', () => {
      var xpub = Bitcore.HDPublicKey.fromString('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
      var res = Utils.xPubToCopayerId('btc', xpub);
      res.should.equal('8b5ae039f102653a49be29ab1625c2e77a987bcbad60715dea147976386e8fa7');
    });

    it('should generate copayerId BCH', () => {
      var xpub = Bitcore.HDPublicKey.fromString('xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj');
      var res = Utils.xPubToCopayerId('bch', 'xpub');
      res.should.equal('5ea2f70a79027e385fea0e47df952db5763d7a749679f639a9f1c7235c86de4b');
    });
  });

  describe('#signMessage', () => {
    it('should sign a message', () => {
      var sig = Utils.signMessage('hola', '09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c');
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
      var res = Utils.verifyMessage('hola', 'badsignature', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify a null signature', () => {
      var res = Utils.verifyMessage('hola', null, '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should fail to verify with wrong pubkey', () => {
      var res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '02555a2d45e309c00cc8c5090b6ec533c6880ab2d3bc970b3943def989b3373f16');
      should.exist(res);
      res.should.equal(false);
    });
    it('should verify', () => {
      var res = Utils.verifyMessage('hola', '3045022100d6186930e4cd9984e3168e15535e2297988555838ad10126d6c20d4ac0e74eb502201095a6319ea0a0de1f1e5fb50f7bf10b8069de10e0083e23dbbf8de9b8e02785', '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f');
      should.exist(res);
      res.should.equal(true);
    });
  });

  describe('#formatAmount', () => {
    it('should successfully format short amount', () => {
      var cases = [{
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
      }];

      _.each(cases, (testCase) => {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
    it('should successfully format full amount', () => {
      var cases = [{
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
      },];

      _.each(cases, (testCase) => {
        testCase.args[2] = testCase.args[2] || {};
        testCase.args[2].fullPrecision = true;
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
  });

  describe('#signMessage #verifyMessage round trip', () => {
    it('should sign and verify', () => {
      var msg = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
      var sig = Utils.signMessage(msg, '09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c');
      Utils.verifyMessage(msg, sig, '03bec86ad4a8a91fe7c11ec06af27246ec55094db3d86098b7d8b2f12afe47627f').should.equal(true);
    });
  });

  describe('#encryptMessage #decryptMessage round trip', () => {
    it('should encrypt and decrypt', () => {
      var pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      var ct = Utils.encryptMessage('hello world', pwd);
      var msg = Utils.decryptMessage(ct, pwd);
      msg.should.equal('hello world');
    });
  });


  describe('#decryptMessage should throw', () => {
    it('should encrypt and decrypt', () => {
      var pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      var ct = Utils.encryptMessage('hello world', pwd);
      (() => {
        Utils.decryptMessage(ct, 'test')
      }).should.throw('invalid aes key size');
    });
  });

  describe('#decryptMessageNoThrow should not throw', () => {
    it('should encrypt and decrypt', () => {
      var pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      var ct = Utils.encryptMessage('hello world', pwd);
      var msg = Utils.decryptMessageNoThrow(ct, pwd);

      msg.should.equal('hello world');
    });

    it('should encrypt and  fail to decrypt', () => {
      var pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      var ct = Utils.encryptMessage('hello world', pwd);
      var msg = Utils.decryptMessageNoThrow(ct, 'hola');

      msg.should.equal('<ECANNOTDECRYPT>');
    });


    it('should failover to decrypt a non-encrypted msg', () => {
      var pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      var msg = Utils.decryptMessageNoThrow('hola mundo', 'hola');

      msg.should.equal('hola mundo');
    });

    it('should failover to decrypt a non-encrypted msg (case 2)', () => {
      var pwd = "ezDRS2NRchMJLf1IWtjL5A==";
      var msg = Utils.decryptMessageNoThrow('{"pepe":1}', 'hola');

      msg.should.equal('{"pepe":1}');
    });


    it('should no try to decrypt empty', () => {
      var msg = Utils.decryptMessageNoThrow('', 'hola');
      msg.should.equal('');
    });


    it('should no try to decrypt null', () => {
      var msg = Utils.decryptMessageNoThrow(null, 'hola');
      msg.should.equal('');
    });


  });



  describe('#getProposalHash', () => {
    it('should compute hash for old style proposals', () => {
      var hash = Utils.getProposalHash('msj42CCGruhRsFrGATiUuh25dtxYtnpbTx', 1234, 'the message');
      hash.should.equal('msj42CCGruhRsFrGATiUuh25dtxYtnpbTx|1234|the message|');
    });
    it('should compute hash for arbitrary proposal', () => {
      var header1 = {
        type: 'simple',
        version: '1.0',
        toAddress: 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx',
        amount: 1234,
        message: {
          one: 'one',
          two: 'two'
        },
      };

      var header2 = {
        toAddress: 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx',
        type: 'simple',
        version: '1.0',
        message: {
          two: 'two',
          one: 'one'
        },
        amount: 1234,
      };

      var hash1 = Utils.getProposalHash(header1);
      var hash2 = Utils.getProposalHash(header2);

      hash1.should.equal(hash2);
    });
  });

  describe('#privateKeyToAESKey', () => {
    it('should be ok', () => {
      var privKey = new Bitcore.PrivateKey('09458c090a69a38368975fb68115df2f4b0ab7d1bc463fc60c67aa1730641d6c').toString();
      Utils.privateKeyToAESKey(privKey).should.be.equal('2HvmUYBSD0gXLea6z0n7EQ==');
    });
    it('should fail if pk has invalid values', () => {
      var values = [
        null,
        123,
        'x123',
      ];
      _.each(values, (value) => {
        var valid = true;
        try {
          Utils.privateKeyToAESKey(value);
        } catch (e) {
          valid = false;
        }
        valid.should.be.false;
      });
    });
  });

  describe('#verifyRequestPubKey', () => {
    it('should generate and check request pub key', () => {
      var reqPubKey = (new Bitcore.PrivateKey).toPublicKey();
      var xPrivKey = new Bitcore.HDPrivateKey();
      var xPubKey = new Bitcore.HDPublicKey(xPrivKey);


      var sig = Utils.signRequestPubKey(reqPubKey.toString(), xPrivKey);
      var valid = Utils.verifyRequestPubKey(reqPubKey.toString(), sig, xPubKey);
      valid.should.be.equal(true);
    });

    it('should fail to check a request pub key with wrong key', () => {
      var reqPubKey = '02c2c1c6e75cfc50235ff4a2eb848385c2871b8c94e285ee82eaced1dcd5dd568e';
      var xPrivKey = new Bitcore.HDPrivateKey();
      var xPubKey = new Bitcore.HDPublicKey(xPrivKey);
      var sig = Utils.signRequestPubKey(reqPubKey, xPrivKey);

      var xPrivKey2 = new Bitcore.HDPrivateKey();
      var xPubKey2 = new Bitcore.HDPublicKey(xPrivKey2);
      var valid = Utils.verifyRequestPubKey(reqPubKey, sig, xPubKey2);
      valid.should.be.equal(false);
    });
  });
});
