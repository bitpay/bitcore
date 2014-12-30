'use strict';

var assert = require('assert');
var bitcore = require('bitcore');

var Stealth = require('../');

var PrivateKey = bitcore.PrivateKey;

var saddrLive = 'vJmtjxSDxNPXL4RNapp9ARdqKz3uJyf1EDGjr1Fgqs9c8mYsVH82h8wvnA4i5rtJ57mr3kor1EVJrd4e5upACJd588xe52yXtzumxj';
var saddrLive2 = 'hfFELudSDw7rBvGyadXF9DZbcsE92YJGaA4LniuuyYyenZPzFmnF4M74e';

var scanKeyLive = '025e58a31122b38c86abc119b9379fe247410aee87a533f9c07b189aef6c3c1f52';
var spendKeyLive = '03616562c98e7d7b74be409a787cec3a912122f3fb331a9bee9b0b73ce7b9f50af';

var saddrTest = 'waPTqV9DUa13rP6meQh2b8XUHrxDDgL5yCycNpRLh5CzyZXmhzR3kLwyVSNxTBhW8dwHbwVhMATrepTRRF79mw3r3hHrAGwCiebxTi';
var scanKeyTest = '02161a00c1033d2b3ad25adb48b5b8f762458ef7d00be574ef2b5234c736437e55';
var spendKeyTest = '03c754bddd34efee26ff66084ca101e1b03da4ec623d34051edaef48e1b0c06f99';

var multisigAddress = '2Ctqsd4cHgrGfMqFgQXrRmREFZdSrNSys7LQSMaK6y9bhsVsFuDbsgipTCXyZtRwHydd6Wcacghh78oHA8NcGAhqcpRfPHFpj6XvZGyGgsN2HDXtd8ULjpoUCbJfPJB4woFhX2Rds4ZwfQ5xmHaW';

describe('Stealth Address', function() {
  
  it('provides a constructor', function() {
    assert.equal(typeof Stealth.Address , 'function');
  });
  
  it('should not require the "new" keyword', function() {
    var address = Stealth.Address(saddrLive);
    assert.ok(address instanceof Stealth.Address);
  });
  
  it('provides a copy constructor', function() {
    var address = Stealth.Address(saddrLive);
    var address2 = Stealth.Address(address);
    assert.equal(address, address2);
  });

  it('creates instance from livenet string', function() {
    var address = new Stealth.Address(saddrLive);
    assert.ok(address instanceof Stealth.Address);

    assert.equal(address.network, bitcore.Networks.livenet);
    assert.equal(address.reuseScan, false);
    assert.equal(address.scanKey.toString(), scanKeyLive);
    assert.equal(address.spendKeys.length, 1);
    assert.equal(address.spendKeys[0].toString(), spendKeyLive);
    assert.equal(address.signatures, 1);
    assert.equal(address.prefix, '');
  });

  it('creates instance from testnet string', function() {
    var address = new Stealth.Address(saddrTest);
    assert.ok(address instanceof Stealth.Address);

    assert.equal(address.network, bitcore.Networks.testnet);
    assert.equal(address.reuseScan, false);
    assert.equal(address.scanKey.toString(), scanKeyTest);
    assert.equal(address.spendKeys.length, 1);
    assert.equal(address.spendKeys[0].toString(), spendKeyTest);
    assert.equal(address.signatures, 1);
    assert.equal(address.prefix, '');
  });

  it('creates instance from sort livenet string', function() {
    var address = new Stealth.Address(saddrLive2);
    assert.ok(address instanceof Stealth.Address);

    assert.equal(address.network, bitcore.Networks.livenet);
    assert.equal(address.reuseScan, true);
    assert.equal(address.scanKey.toString(), scanKeyLive);
    assert.equal(address.spendKeys.length, 0);
    assert.equal(address.signatures, 1);
    assert.equal(address.prefix, '');
  });

  it('creates from scanKey', function() {
    var scankey = new bitcore.PublicKey(scanKeyLive);
    var address = new Stealth.Address(scankey);
    assert.equal(address.reuseScan, true);
  });

  it('creates from spendKeys array and scanKey', function() {
    var scankey = new bitcore.PublicKey(scanKeyLive);
    var spendKeys = [new bitcore.PublicKey(spendKeyLive)];

    var address = new Stealth.Address(scankey, spendKeys);
    assert.equal(address.toString(), saddrLive);
    assert.equal(address.reuseScan, false);
  });

  it('creates from simple spendKey and scannKey', function() {
    var scankey = new bitcore.PublicKey(scanKeyLive);
    var spendKey = new bitcore.PublicKey(spendKeyLive);

    var address = new Stealth.Address(scankey, spendKey);
    assert.equal(address.toString(), saddrLive);
    assert.equal(address.reuseScan, false);
  });

  it('creates from simple spendKey and scannKey strings', function() {
    var address = new Stealth.Address(scanKeyLive, spendKeyLive);
    assert.equal(address.toString(), saddrLive);
    assert.equal(address.reuseScan, false);
  });

  it('support multisig addresses', function() {
    var spendKeys = [spendKeyLive, spendKeyTest];
    var address = new Stealth.Address(scanKeyLive, spendKeys, 2);
    assert.equal(address.toString(), multisigAddress);
    assert.equal(address.reuseScan, false);
  });

  it('multisig addresses requires all signatures by defualt', function() {
    var spendKeys = [spendKeyLive, spendKeyTest];
    var address = new Stealth.Address(scanKeyLive, spendKeys);
    assert.equal(address.signatures, 2);
  });

  it('validates number of signatures', function() {
    var spendKeys = [spendKeyLive, spendKeyLive];
    var address = new Stealth.Address(scanKeyLive, spendKeys, 2);
    assert.throws(function() {
      new Stealth.Address(spendKeys, scanKeyLive, 3);
    });
  });

  describe('Stealth derivation', function() {
    var stealthAddress = "vJmtjxSDxNPXL4RNapp9ARdqKz3uJyf1EDGjr1Fgqs9c8mYsVH82h8wvnA4i5rtJ57mr3kor1EVJrd4e5upACJd588xe52yXtzumxj";
    var scanSecret = "3e49e7257cb31db997edb1cf8299af0f37e2663e2260e4b8033e49d39a6d02f2";
    var spendSecret = "aa3db0cfb3edc94de4d10f873f8190843f2a17484f6021a95a7742302c744748";
    var ephemSecret = "9e63abaf8dcd5ea3919e6de0b6c544e00bf51bf92496113a01d6e369944dc091";
    var stealthSecret = "4e422fb1e5e1db6c1f6ab32a7706d368ceb385e7fab098e633c5c5949c3b97cd";

    it('Sender: generate a payment address', function() {
      var address = new Stealth.Address(stealthAddress);
      var ephemeral = new bitcore.PrivateKey(ephemSecret);
      var expectedStealthKey = new bitcore.PrivateKey(stealthSecret).publicKey;

      var paymentAddress = address.toPaymentAddress(ephemeral);
      assert.equal(paymentAddress.toString(), expectedStealthKey.toAddress().toString());
    });

    it.skip('reuseScan generates payment address', function() {
      
    });

    it('Scanner: generate stealth public key', function() {
      var ephemeral = new bitcore.PrivateKey(ephemSecret).publicKey;
      var scanKey = new bitcore.PrivateKey(scanSecret);
      var spendKey = new bitcore.PrivateKey(spendSecret).publicKey;
      var expectedStealthKey = new bitcore.PrivateKey(stealthSecret).publicKey;

      var stealthKey = Stealth.Address.getStealthPublicKey(ephemeral, scanKey, spendKey)
      assert.equal(stealthKey.toString(), expectedStealthKey.toString());
    });

    it('Receiver: generate stealth private key', function() {
      var ephemeral = new bitcore.PrivateKey(ephemSecret).publicKey;
      var scanKey = new bitcore.PrivateKey(scanSecret);
      var spendKey = new bitcore.PrivateKey(spendSecret);
      var expectedStealthKey = new bitcore.PrivateKey(stealthSecret);

      var stealthKey = Stealth.Address.getStealthPrivateKey(ephemeral, scanKey, spendKey)
      assert.equal(stealthKey.toString(), expectedStealthKey.toString());
    });

  });

  it('validates an stealth address', function() {
    assert.ok(Stealth.Address.isValid(saddrLive));
    assert.ok(!Stealth.Address.isValid('invalid address'));
    assert.ok(!Stealth.Address.isValid('15LihmsdPn816t1LYa5sgWTAdaT8DfZq5s'));
  });

  it.skip('is multisig', function() {
    
  });

  it.skip('reuse scan helper', function() {
    
  });

  it.skip('accepts private keys in constructor', function() {
    
  });

  it.skip('getPaymentAddress method', function() {
    
  });

  it.skip('getPaymentAddress static', function() {
    
  });

});
