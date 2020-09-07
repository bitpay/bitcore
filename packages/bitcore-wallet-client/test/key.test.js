'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();

var { Key } = require('../ts_build/lib/key');

describe('Key', function() {
  describe('#create', function() {
    it('Should create', function() {
      const key = new Key();
      const c = key.get();
      should.exist(c.xPrivKey, 'xpriv');
      should.exist(c.mnemonic);
    });

    it('Should create random keys', function() {
      var all = {};
      for (var i = 0; i < 10; i++) {
        const key = new Key();
        const c = key.get();
        var exist = all[c.xPrivKey];
        should.not.exist(exist);
        all[c.xPrivKey] = 1;
      }
    });

    it('Should create keys from mnemonic (no passphrase) ', function() {
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      });
      key.fingerPrint.should.equal('73c5da0a');

      const c = key.get();
      c.xPrivKey.should.equal(
        'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu'
      );
    });

    it('Should create keys from mnemonic (with passphrase) ', function() {
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        passphrase: 'pepe'
      });
      const c = key.get();
      key.fingerPrint.should.equal('8b64040c');
      c.xPrivKey.should.equal(
        'xprv9s21ZrQH143K4C14pRZ5fTForcjAuRXLHs7Td28XuG2JMEC17Xm6JMGpNMRdNgfKZnyT3nmfeH8yVzxp6jnhmpVQAEmNBxLBh6t6t5UTVxo'
      );
    });

    it('Should return priv key', function() {
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      });
      key
        .get()
        .xPrivKey.should.be.equal(
          'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu'
        );
    });

    it('Should return mnemonic', function() {
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      });
      key
        .get()
        .mnemonic.should.be.equal(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
        );
    });
  });

  describe('#checkPassword', function() {
    it('Should return null', function() {
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      });
      should.not.exist(key.checkPassword('xx'));
    });
    it('Should return true/false', function() {
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      });
      key.encrypt('xx');
      key.checkPassword('xx').should.equal(true);
      key.checkPassword('yy').should.equal(false);
    });
  });

  describe('#match', function() {
    it('Should match', function() {
      const c = new Key();
      Key.match(c, c).should.equal(true);
    });

    it('Should match (after import)', function() {
      const c = new Key();
      const c2 = new Key({ seedType: 'object', seedData: c.toObj() });

      Key.match(c, c2).should.equal(true);
    });

    it("Shouldn't match", function() {
      var c = new Key();
      var c2 = new Key();
      Key.match(c, c2).should.equal(false);
    });
  });

  describe('Encryption', function() {
    describe('#encrypt', function() {
      it('should create encrypted private key and remove cleartext', function() {
        var c = new Key({ seedType: 'new', password: 'password' });
        c.isPrivKeyEncrypted().should.be.true;
        c = c.toObj();
        should.exist(c.xPrivKeyEncrypted);
        should.exist(c.mnemonicEncrypted);
        should.not.exist(c.xPrivKey);
        should.not.exist(c.mnemonic);
      });

      it('should create encrypted private key and get', function() {
        var c = new Key({ seedType: 'new', password: 'password' });
        c.isPrivKeyEncrypted().should.be.true;

        const keys2 = c.get('password');
        should.exist(keys2);
        should.exist(keys2.mnemonic);
        should.exist(keys2.xPrivKey);

        c = c.toObj();
        should.not.exist(c.xPrivKey);
        should.not.exist(c.mnemonic);
        should.exist(c.xPrivKeyEncrypted);
        should.exist(c.mnemonicEncrypted);
      });

      it('should encrypt private key and remove cleartext (2 steps)', function() {
        var c = new Key({ seedType: 'new' });
        c.encrypt('password');
        c.isPrivKeyEncrypted().should.be.true;
        c = c.toObj();
        should.exist(c.xPrivKeyEncrypted);
        should.exist(c.mnemonicEncrypted);
        should.not.exist(c.xPrivKey);
        should.not.exist(c.mnemonic);
      });
      it('should fail to encrypt private key if already encrypted', function() {
        var c = new Key({ seedType: 'new' });
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
        var c = new Key({ seedType: 'new' });
        c.encrypt('password');
        c.isPrivKeyEncrypted().should.be.true;
        c.decrypt('password');
        c.isPrivKeyEncrypted().should.be.false;
        c = c.toObj();
        should.exist(c.xPrivKey);
        should.exist(c.mnemonic);
        should.not.exist(c.xPrivKeyEncrypted);
        should.not.exist(c.mnemonicEncrypted);
      });
      it('should fail to decrypt private key with wrong password', function() {
        var c = new Key();
        c.encrypt('password');

        var err;
        try {
          c.decrypt('wrong');
        } catch (ex) {
          // ex.toString().should.match(/Could not decrypt/); TODO
          err = ex;
        }
        should.exist(err);
        c.isPrivKeyEncrypted().should.be.true;
        c = c.toObj();
        should.exist(c.mnemonicEncrypted);
        should.not.exist(c.mnemonic);
      });
      it('should fail to decrypt private key when not encrypted', function() {
        var c = new Key();

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
        var c = new Key();
        var keys = c.get();
        should.exist(keys.xPrivKey);
        should.exist(keys.mnemonic);

        let o = c.toObj();
        keys.xPrivKey.should.equal(o.xPrivKey);
        keys.mnemonic.should.equal(o.mnemonic);

        c.encrypt('password');
        c.isPrivKeyEncrypted().should.be.true;
        var keys2 = c.get('password');
        should.exist(keys2);
        keys2.should.deep.equal(keys);

        c.decrypt('password');
        c.isPrivKeyEncrypted().should.be.false;
        var keys3 = c.get();
        should.exist(keys3);
        keys3.should.deep.equal(keys);
      });
      it('should get derived keys regardless of encryption', function() {
        var c = new Key();
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

  describe('#fromExtendedPrivateKey', function() {
    it('Should create credentials from seed', function() {
      var xPriv =
        'xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc';
      var k = new Key({ seedType:'extendedPrivateKey', seedData: xPriv});
      var c = k.createCredentials(null, {
        coin: 'btc',
        network: 'livenet',
        account: 0,
        n: 1
      });

      k = k.toObj();
      k.xPrivKey.should.equal(
        'xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc'
      );
      c.xPubKey.should.equal(
        'xpub6DUean44k773kxbUq8QpSmAPFaNCpk5AzrxbFRAMsNCZBGD15XQVnRJCgNd8GtJVmDyDZh89NPZz1XPQeX5w6bAdLGfSTUuPDEQwBgKxfh1'
      );
      c.copayerId.should.equal('bad66ef88ad8dec08e36d576c29b4f091d30197f04e166871e64bf969d08a958');
      c.network.should.equal('livenet');
      c.personalEncryptingKey.should.equal('M4MTmfRZaTtX6izAAxTpJg==');
      should.not.exist(c.walletPrivKey);
    });

    it('Should create credentials from seed and walletPrivateKey', function() {
      var xPriv =
        'xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc';
      var wKey = 'a28840e18650b1de8cb83bcd2213672a728be38a63e70680b0c2be9c452e2d4d';
      var k = new Key({ seedType: 'extendedPrivateKey', seedData:xPriv });
      var c = k.createCredentials(null, {
        coin: 'btc',
        network: 'livenet',
        account: 0,
        n: 1,
        walletPrivKey: wKey
      });
      k = k.toObj();
      k.xPrivKey.should.equal(
        'xprv9s21ZrQH143K2TjT3rF4m5AJcMvCetfQbVjFEx1Rped8qzcMJwbqxv21k3ftL69z7n3gqvvHthkdzbW14gxEFDYQdrRQMub3XdkJyt3GGGc'
      );
      c.walletPrivKey.should.equal(wKey);
    });

    describe('Compliant derivation', function() {
      it('Should create compliant base address derivation key', function() {
        var xPriv =
          'xprv9s21ZrQH143K4HHBKb6APEoa5i58fxeFWP1x5AGMfr6zXB3A6Hjt7f9LrPXp9P7CiTCA3Hk66cS4g8enUHWpYHpNhtufxSrSpcbaQyVX163';
        var k = new Key({ seedType: 'extendedPrivateKey', seedData:xPriv });
        var c = k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        });
        c.xPubKey.should.equal(
          'xpub6CUtFEwZKBEyX6xF4ECdJdfRBBo69ufVgmRpy7oqzWJBSadSZ3vaqvCPNFsarga4UWcgTuoDQL7ZnpgWkUVUAX3oc7ej8qfLEuhMALGvFwX'
        );
      });

      it('Should create compliant request key', function() {
        var xPriv =
          'xprv9s21ZrQH143K3xMCR1BNaUrTuh1XJnsj8KjEL5VpQty3NY8ufgbR8SjZS8B4offHq6Jj5WhgFpM2dcYxeqLLCuj1wgMnSfmZuPUtGk8rWT7';
        var k = new Key({ seedType: 'extendedPrivateKey', seedData:xPriv });
        var c = k.createCredentials(null, {
          coin: 'btc',
          network: 'livenet',
          account: 0,
          n: 1
        });
        c.requestPrivKey.should.equal('559371263eb0b2fd9cd2aa773ca5fea69ed1f9d9bdb8a094db321f02e9d53cec');
      });

      it('should accept non-compliant derivation as a parameter when importing', function() {
        var xPriv =
          'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k';
        var k = new Key({ seedType: 'extendedPrivateKey', seedData:xPriv,   nonCompliantDerivation: true });
        var c = k.createCredentials(null, {
          coin: 'btc',
          network: 'testnet',
          account: 0,
          n: 1
        });

        k = k.toObj();
        k.xPrivKey.should.equal(
          'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k'
        );
        k.compliantDerivation.should.be.false;
        c.xPubKey.should.equal(
          'tpubDD919WKKqmh2CqKnSsfUAJWB9bnLbcry6r61tBuY8YEaTBBpvXSpwdXXBGAB1n4JRFDC7ebo7if3psUAMpvQJUBe3LcjuMNA6Y4nP8U9SNg'
        );
      });
    });
  });

  describe('#derive', function() {
    it('should derive extended private key from master livenet', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var xpk = c.derive(null, "m/44'/0'/0'").toString();
      xpk.should.equal(
        'xprv9xud2WztGSSBPDPDL9RQ3rG3vucRA4BmEnfAdP76bTqtkGCK8VzWjevLw9LsdqwH1PEWiwcjymf1T2FLp12XjwjuCRvcSBJvxDgv1BDTbWY'
      );
    });
    it('should derive extended private key from master BIP48 livenet', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var xpk = c.derive(null, "m/48'/0'/0'").toString();
      xpk.should.equal(
        'xprv9yaGCLKPS2ovEGw987MZr4DCkfZHGh518ndVk3Jb6eiUdPwCQu7nYru59WoNkTEQvmhnv5sPbYxeuee5k8QASWRnGV2iFX4RmKXEQse8KnQ'
      );
    });
    it('should derive compliant child', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k'});
      c.compliantDerivation.should.be.true;
      var xpk = c.derive(null, "m/44'/1'/0'").toString();
      xpk.should.equal(
        'tprv8gXvQvjGt7oYCTRD3d4oeQr9B7JLuC2B6S854F4XWCQ4pr9NcjokH9kouWMAp1MJKy4Y8QLBgbmPtk3i7RegVzaWhWsnVPi4ZmykJXt4HeV'
      );
    });
    it('should derive non-compliant child', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'tprv8ZgxMBicQKsPd8U9aBBJ5J2v8XMwKwZvf8qcu2gLK5FRrsrPeSgkEcNHqKx4zwv6cP536m68q2UD7wVM24zdSCpaJRmpowaeJTeVMXL5v5k', nonCompliantDerivation: true});
      c.compliantDerivation.should.be.false;
      var xpk = c.derive(null, "m/44'/1'/0'").toString();
      xpk.should.equal(
        'tprv8gSy16H5hQ1MKNHzZDzsktr4aaGQSHg4XYVEbfsEiGSBcgw4J8dEm8uf19FH4L9h6W47VBKtc3bbYyjb6HAm6QdyRLpB6fsA7bW19RZnby2'
      );
    });
  });

  describe('#createCredentials', function() {
    it('should create 1-1 credentials', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var cred = c.createCredentials(null, {
        coin: 'btc',
        network: 'testnet',
        account: 0,
        n: 1
      });
      c.compliantDerivation.should.equal(true);
      cred.addressType.should.equal('P2PKH');
      cred.rootPath.should.equal("m/44'/1'/0'");
    });

    it('should create 2-2 credentials', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var cred = c.createCredentials(null, {
        coin: 'bch',
        network: 'livenet',
        account: 1,
        n: 2,
        nonCompliantDerivation: true
      });
      cred.account.should.equal(1);
      cred.addressType.should.equal('P2SH');
      cred.n.should.equal(2);
      cred.rootPath.should.equal("m/48'/145'/1'");
      c.compliantDerivation.should.equal(true);
    });
  });

  describe('#getBaseAddressDerivationPath', function() {
    it('should return path for livenet', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var path = c.getBaseAddressDerivationPath({
        account: 0,
        coin: 'btc',
        n: 1
      });
      path.should.equal("m/44'/0'/0'");
    });
    it('should return path for testnet account 2', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var path = c.getBaseAddressDerivationPath({
        account: 2,
        coin: 'btc',
        network: 'testnet',
        n: 1
      });
      path.should.equal("m/44'/1'/2'");
    });

    it('should return path for testnet account 1', function() {
      var c = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });
      var path = c.getBaseAddressDerivationPath({
        account: 1,
        coin: 'btc',
        network: 'testnet',
        n: 1
      });
      path.should.equal("m/44'/1'/1'");
    });
  });

  describe('#createCredentials 2', function() {
    it('should return different copayerId for different coin / accounts', function() {
      var k = new Key({ seedType: 'extendedPrivateKey', seedData: 'xprv9s21ZrQH143K3zLpjtB4J4yrRfDTEfbrMa9vLZaTAv5BzASwBmA16mdBmZKpMLssw1AzTnm31HAD2pk2bsnZ9dccxaLD48mRdhtw82XoiBi' });

      let c = k.createCredentials(null, {
        coin: 'btc',
        account: 0,
        network: 'livenet',
        n: 1
      });
      let c1 = k.createCredentials(null, {
        coin: 'btc',
        account: 1,
        network: 'livenet',
        n: 1
      });
      let c2 = k.createCredentials(null, {
        coin: 'bch',
        account: 1,
        network: 'livenet',
        n: 1
      });
      c.copayerId.should.equal('4abffe3e0e52a4cec11ebf966675cb526566919a8a0d5de36d9b2898ee804a58');
      c1.copayerId.should.equal('911867838cffffc2bbd05e519f1932d56c49b93a908136ce7a17b70573c1c428');
      c2.copayerId.should.equal('dc9577aa5054563f31047463e25ec52f96c5b1fa93c4b567f2329eb6a66517d0');
    });

    it('should return different copayerId for different network', function() {
      var words = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      var k = new Key({ seedType: 'mnemonic', seedData: words });
      var c = k.createCredentials(null, {
        coin: 'btc',
        account: 0,
        network: 'livenet',
        n: 1
      });
      c.copayerId.should.equal('af4e120530f26ffa834739b0eb030093c881bf73f8f893fc6837823325da83f2');

      var c2 = k.createCredentials(null, {
        coin: 'btc',
        account: 0,
        network: 'testnet',
        n: 1
      });

      c2.copayerId.should.equal('51d883fcd4ec010a89503c4b64e0cf22fe706495a9cf086bec69194c1c8f8952');
    });
  });

  describe('#createWithMnemonic #fromMnemonic roundtrip', function() {
    _.each(['en', 'es', 'ja', 'zh', 'fr'], function(lang) {
      it('Should verify roundtrip create/from with ' + lang + '/passphrase', function() {
        var c = new Key({ seedType: 'new', language: lang });
        c = c.toObj();
        should.exist(c.mnemonic);
        var words = c.mnemonic;
        var xPriv = c.xPrivKey;

        var c2 = new Key({ seedType: 'mnemonic', seedData: words });
        c2 = c2.toObj();
        should.exist(c2.mnemonic);
        words.should.be.equal(c2.mnemonic);
        c2.xPrivKey.should.equal(c.xPrivKey);
      });
    });

    it('Should fail roundtrip create/from with ES/passphrase with wrong passphrase', function() {
      var c = new Key({ seedType: 'new', language: 'es', passphrase: 'holamundo' });
      c = c.toObj();
      should.exist(c.mnemonic);
      var words = c.mnemonic;
      var xPriv = c.xPrivKey;

      var c2 = new Key({ seedType: 'mnemonic', seedData: c.mnemonic, passphrase: 'chaumundo' });
      c2.toObj().xPrivKey.should.not.equal(c.xPrivKey);
    });
    it('Should fail roundtrip create/from with ES/passphrase with null passphrase', function() {
      var c = new Key({ seedType: 'new', language: 'es', passphrase: 'holamundo' });
      c = c.toObj();
      should.exist(c.mnemonic);
      var words = c.mnemonic;
      var xPriv = c.xPrivKey;

      var c2 = new Key({ seedType: 'mnemonic', seedData: c.mnemonic });
      c2 = c2.toObj();
      c2.xPrivKey.should.not.equal(c.xPrivKey);
    });
    it('Should verify roundtrip create/from with ES/passphrase with ok passphrase', function() {
      var c = new Key({ seedType: 'new', language: 'es', passphrase: 'holamundo' });
      c = c.toObj();
      should.exist(c.mnemonic);
      var words = c.mnemonic;
      var xPriv = c.xPrivKey;

      var c2 = new Key({ seedType: 'mnemonic', seedData: c.mnemonic, passphrase: 'holamundo' });
      c2 = c2.toObj();
      c2.xPrivKey.should.equal(c.xPrivKey);
    });
  });

  describe('from/toObj', () => {
    it('should export & import', function() {
      var c = new Key();

      var exported = c.toObj();
      let imported = new Key({ seedType: 'object', seedData: exported} );
      imported.get().xPrivKey.should.equal(c.get().xPrivKey);
      imported.get().mnemonic.should.equal(c.get().mnemonic);
    });

    it('should export & import encrypted and fail if password not supplied', function() {
      var c = new Key();
      let x = c.get().xPrivKey;

      c.encrypt('pepe');

      var exported = c.toObj();
      let imported = new Key({ seedType: 'object', seedData: exported} );
      (() => {
        imported.get().xPrivKey.should.equal(x);
      }).should.throw('encrypted');

      imported = imported.toObj();
      should.not.exist(imported.xPrivKey);
      should.not.exist(imported.mnemonic);
      should.exist(imported.xPrivKeyEncrypted);
      should.exist(imported.mnemonicEncrypted);
    });
    it('should export & import encrypted and restore if password supplied', function() {
      var c = new Key();
      let x = c.get().xPrivKey;
      let m = c.get().mnemonic;

      c.encrypt('pepe');

      var exported = c.toObj();
      let imported = new Key({ seedType: 'object', seedData: exported} );
      imported.get('pepe').xPrivKey.should.equal(x);
      imported.get('pepe').mnemonic.should.equal(m);

      imported = imported.toObj();
      should.not.exist(imported.xPrivKey);
      should.not.exist(imported.mnemonic);
      should.exist(imported.xPrivKeyEncrypted);
      should.exist(imported.mnemonicEncrypted);
      should.exist(imported.fingerPrint);
    });
  });
});
