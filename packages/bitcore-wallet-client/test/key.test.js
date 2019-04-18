'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();

var Constants = require('../lib/common/constants');
var Key = require('../lib/key');
var TestData = require('./testdata');

describe('Key', function() {

  describe('#create', function() {
    it('Should create', function() {
      var c = Key.create();
      should.exist(c.xPrivKey);
      should.exist(c.mnemonic);
    });

    it('Should create random keys', function() {
      var all = {};
      for (var i = 0; i < 10; i++) {
        var c = Key.create();
        var exist = all[c.xPrivKey];
        should.not.exist(exist);
        all[c.xPrivKey] = 1;
      }
    });

    it('Should create keys from mnemonic (no passphrase) ', function() {
      var all = {};
      var c = Key.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
    });


    it('Should create keys from mnemonic (with passphrase) ', function() {
      var all = {};
      var c = Key.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'pepe');
      c.xPrivKey.should.equal('xprv9s21ZrQH143K4C14pRZ5fTForcjAuRXLHs7Td28XuG2JMEC17Xm6JMGpNMRdNgfKZnyT3nmfeH8yVzxp6jnhmpVQAEmNBxLBh6t6t5UTVxo');
    });


    it('Should return priv key', function() {
      var all = {};
      var c = Key.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      c.get().xPrivKey.should.be.equal('xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu');
    });


 
    it('Should return mnemonic', function() {
      var all = {};
      var c = Key.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      c.get(null, true).mnemonic.should.be.equal('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    });



    describe('Encryption', function() {
      describe('#encrypt', function() {
        it('should encrypt private key and remove cleartext', function() {
          var c = Key.create();
          c.encrypt('password');
          c.isPrivKeyEncrypted().should.be.true;
          should.exist(c.xPrivKeyEncrypted);
          should.exist(c.mnemonicEncrypted);
          should.not.exist(c.xPrivKey);
          should.not.exist(c.mnemonic);
        });
        it('should fail to encrypt private key if already encrypted', function() {
          var c = Key.create();
          c.encrypt('password');
          var err;
          try {
            c.encrypt('password');
          } catch (ex) {
            err = ex;
          }
          should.exist(err);
        });
      });
      describe('#decryptPrivateKey', function() {
        it('should decrypt private key', function() {
          var c = Key.create();
          c.encrypt('password');
          c.isPrivKeyEncrypted().should.be.true;
          c.decrypt('password');
          c.isPrivKeyEncrypted().should.be.false;
          should.exist(c.xPrivKey);
          should.exist(c.mnemonic);
          should.not.exist(c.xPrivKeyEncrypted);
          should.not.exist(c.mnemonicEncrypted);
        });
        it('should fail to decrypt private key with wrong password', function() {
          var c = Key.create();
          c.encrypt('password');

          var err;
          try {
            c.decrypt('wrong');
          } catch (ex) {
            ex.toString().should.match(/Could not decrypt/);
            err = ex;
          }
          should.exist(err);
          c.isPrivKeyEncrypted().should.be.true;
          should.exist(c.mnemonicEncrypted);
          should.not.exist(c.mnemonic);
        });
        it('should fail to decrypt private key when not encrypted', function() {
          var c = Key.create();

          var err;
          try {
            c.decrypt('password');
          } catch (ex) {
            ex.toString().should.match(/not encrypted/);
            err = ex;
          }
          should.exist(err);
          c.isPrivKeyEncrypted().should.be.false;
        });
      });
      describe('#getKeys', function() {
        it('should get keys regardless of encryption', function() {
          var c = Key.create();
          var keys = c.get(null, true);
          should.exist(keys.xPrivKey);
          should.exist(keys.mnemonic);
          keys.xPrivKey.should.equal(c.xPrivKey);
          keys.mnemonic.should.equal(c.mnemonic);

          c.encrypt('password');
          c.isPrivKeyEncrypted().should.be.true;
          var keys2 = c.get('password', true);
          should.exist(keys2);
          keys2.should.deep.equal(keys);

          c.decrypt('password');
          c.isPrivKeyEncrypted().should.be.false;
          var keys3 = c.get(null, true);
          should.exist(keys3);
          keys3.should.deep.equal(keys);
        });
        it('should get derived keys regardless of encryption', function() {
          var c = Key.create();
          var xPrivKey = c.derive(null, 'm/44');
          should.exist(xPrivKey);

          c.encrypt('password');
          c.isPrivKeyEncrypted().should.be.true;
          var xPrivKey2 = c.derive('password', 'm/44');
          should.exist(xPrivKey2);

          xPrivKey2.toString('hex').should.equal(xPrivKey.toString('hex'));

          c.decrypt('password');
          c.isPrivKeyEncrypted().should.be.false;
          var xPrivKey3 = c.derive(null, 'm/44');
          should.exist(xPrivKey3);
          xPrivKey3.toString('hex').should.equal(xPrivKey.toString('hex'));
        });
      });
    });

  describe('#derive', function() {
    it('should derive extended private key from master livenet', function() {
      var c = Key.fromExtendedPrivateKey('btc', 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi', 0, 'BIP44');
      var xpk = c.getDerivedXPrivKey().toString();
      xpk.should.equal('xprv9xud2WztGSSBPDPDL9RQ3rG3vucRA4BmEnfAdP76bTqtkGCK8VzWjevLw9LsdqwH1PEWiwcjymf1T2FLp12XjwjuCRvcSBJvxDgv1BDTbWY');
    });
    it('should derive extended private key from master testnet', function() {
      var c = Credentials.fromExtendedPrivateKey('btc', 'tprv8ZgxMBicQKsPfPX8avSJXY1tZYJJESNg8vR88i8rJFkQJm6HgPPtDEmD36NLVSJWV5ieejVCK62NdggXmfMEHog598PxvXuLEsWgE6tKdwz', 0, 'BIP44');
      var xpk = c.getDerivedXPrivKey().toString();
      xpk.should.equal('tprv8gBu8N7JbHZs7MsW4kgE8LAYMhGJES9JP6DHsj2gw9Tc5PrF5Grr9ynAZkH1LyWsxjaAyCuEMFKTKhzdSaykpqzUnmEhpLsxfujWHA66N93');
    });
    it('should derive extended private key from master BIP48 livenet', function() {
      var c = Credentials.fromExtendedPrivateKey('btc', 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi', 0, 'BIP48');
      var xpk = c.getDerivedXPrivKey().toString();
      xpk.should.equal('xprv9yaGCLKPS2ovEGw987MZr4DCkfZHGh518ndVk3Jb6eiUdPwCQu7nYru59WoNkTEQvmhnv5sPbYxeuee5k8QASWRnGV2iFX4RmKXEQse8KnQ');
    });
    it('should derive extended private key from master livenet (BIP45)', function() {
      var c = Credentials.fromExtendedPrivateKey('btc', 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi', 0, 'BIP45');
      var xpk = c.getDerivedXPrivKey().toString();
      xpk.should.equal('xprv9vDaAbbvT8LHKr8v5A2JeFJrnbQk6ZrMDGWuiv2vZgSyugeV4RE7Z9QjBNYsdafdhwEGb6Y48DRrXFVKvYRAub9ExzcmJHt6Js6ybJCSssm');
    });
    it('should set addressType & BIP45', function() {
      var c = Credentials.fromExtendedPrivateKey('btc', 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi', 8, 'BIP45');
      c.addWalletInfo(1, 'name', 1, 1, 'juan');
      c.account.should.equal(8);
    });
    it('should derive compliant child', function() {
      var c = Credentials.fromExtendedPrivateKey('btc', 'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k', 0, 'BIP44');
      c.compliantDerivation.should.be.true;
      var xpk = c.getDerivedXPrivKey().toString();
      xpk.should.equal('tprv8gXvQvjGt7oYCTRD3d4oeQr9B7JLuC2B6S854F4XWCQ4pr9NcjokH9kouWMAp1MJKy4Y8QLBgbmPtk3i7RegVzaWhWsnVPi4ZmykJXt4HeV');
    });
    it('should derive non-compliant child', function() {
      var c = Credentials.fromExtendedPrivateKey('btc', 'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k', 0, 'BIP44', {
        nonCompliantDerivation: true
      });
      c.compliantDerivation.should.be.false;
      var xpk = c.getDerivedXPrivKey().toString();
      xpk.should.equal('tprv8gSy16H5hQ1MKNHzZDzsktr4aaGQSHg4XYVEbfsEiGSBcgw4J8dEm8uf19FH4L9h6W47VBKtc3bbYyjb6HAm6QdyRLpB6fsA7bW19RZnby2');
    });
  });


  });
});


