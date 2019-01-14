'use strict';

var assert = require('assert');
var bitcore = require('bitcore-lib-cash');

var Stealth = require('../');

//var saddrLive = 'vJmsmYVLU7BkBgjRAo1D5sUeqBGHG6KDf4P56U62hexZzDRa9Z8jxCfpMtSSBPkaBVanwsPFMAiCog6Z7Amdi8kNhkHz3H5wsyYJRZ';
var saddrLive = '9GQQY8RNVRLV9NS6YK09JCL6EAK05CG9RA0H9G6J7TFDU8M0FAKAZQMKQYPT4X4RHSLW2V8TZH8SWV584Q5A8PYWRKJ8TJKYA683P7N3RXGSCVCPQQ';

var scanKeyLive = 'L3KGhqJ2iJaVx16NRMCvrzhjQHJQy3tmRFSS4ew9emnHKp9qP1wf';
var spendKeyLive = 'L2v8D4sJU7zT9s8AxdaNUe4TSJqZ5xMERPXVuJmsXxwign46mKZq';

//var multisigAddress = '2aeHATKjckfQEebX8khv295XPj2wbqqMfLajom2y2xyhYuSw8qHfX2LWp2J7HJX7mnMfEthxf2Ase1tEvqGfgXYR3j113TvkDBhdfQ1Z5zPtQBrECwu4WpPYnznpcpVAXTR2vxJLwwezQPZoC4ARRYfPAdsySFUtnt8BarY85rFLTJwHQyKHco3XTR5SZZtoz';

var multisigAddress = '9GQQY6MN6KJ644VNJSWLSQZA434JNYXYR89MSKLKYFWH8ZA6F4ZTA8DQQVPLPJ4Y7MJZFR7CARU4UHLTZSKEXEFYYNVCF6HDK0RM62RA6N60CKQZ0RXFLUQR3CZS60HKMDL478KPD54YH3PTTT5EMV7UQK3E6NQGZZKQYX60W3P3TGL5UX85DVLXLCRLDGE83U8H2JNRQ6UE5A2MYRUYH3FGQGQQ';

var scanKeyMult = 'KzPxjNB6rYLTW9H9QV1QdCBZcbWYDRw1zmVmvRN1LBpD1rNAeiEy';
var signatures = 2;
var spendKeysMult = [
  'L4bjjqF9rRu5ATGEn1TxbgCSEBTvi72MtrL2iVyv6TEQMxehvT4r',
  'L1Qgo6xDAnSbppTH6v5KJywZ7QcdChg5npLAu6rZrZ7nLmfxuqJP',
  'KwnXgbxAzV9XYhGSPRpY2xUN3ZdPqtrxF1GVZBWgzNY3VvQNcke7'
];

describe('Stealth Transaction', function() {
  
  it('provides a constructor', function() {
    assert.equal(typeof Stealth.Transaction , 'function');
  });
  
  it.skip('extends bitcore.Transaction', function() {
    // check prototype
  });

  describe('Pay to stealth address', function() {

    it('pay to pubkey hash', function() {
      var address = new Stealth.Address(saddrLive);
      var tx = new Stealth.Transaction().to(address, 10000);
      
      assert.equal(tx.outputs.length, 2);
      assert.equal(tx.outputs[0].satoshis, 0);
      assert.ok(tx.outputs[0].script.isDataOut());

      assert.equal(tx.outputs[1].satoshis, 10000);
      assert.ok(tx.outputs[1].script.isPublicKeyHashOut());
    });

    it('pay to pubkey hash string', function() {
      var tx = new Stealth.Transaction().to(saddrLive, 10000);
      
      assert.equal(tx.outputs.length, 2);
      assert.equal(tx.outputs[0].satoshis, 0);
      assert.ok(tx.outputs[0].script.isDataOut());

      assert.equal(tx.outputs[1].satoshis, 10000);
      assert.ok(tx.outputs[1].script.isPublicKeyHashOut());
    });

    it('verify pay to pubkey hash output', function() {
      var address = new Stealth.Address(saddrLive);
      var tx = new Stealth.Transaction().to(address, 10000);
      
      var ephemeral = Stealth.Transaction.getEphemeral(tx.outputs[0]);
      var scanKey = new bitcore.PrivateKey(scanKeyLive);
      var spendKey = new bitcore.PrivateKey(spendKeyLive).publicKey;

      var scannedAddress = Stealth.Address.getPubkeyHashPaymentAddress(ephemeral, scanKey, spendKey);
      var paymentAddress = tx.outputs[1].script.toAddress(address.network);

      assert.equal(scannedAddress.toString(), paymentAddress.toString());
    });

    it('pay to multisig address', function() {
      var address = new Stealth.Address(multisigAddress);
      var tx = new Stealth.Transaction().to(address, 10000);
      
      assert.equal(tx.outputs.length, 2);
      assert.equal(tx.outputs[0].satoshis, 0);
      assert.ok(tx.outputs[0].script.isDataOut());

      assert.equal(tx.outputs[1].satoshis, 10000);
      assert.ok(tx.outputs[1].script.isScriptHashOut());
    });

    it('pay to multisig address string', function() {
      var tx = new Stealth.Transaction().to(multisigAddress, 10000);
      
      assert.equal(tx.outputs.length, 2);
      assert.equal(tx.outputs[0].satoshis, 0);
      assert.ok(tx.outputs[0].script.isDataOut());

      assert.equal(tx.outputs[1].satoshis, 10000);
      assert.ok(tx.outputs[1].script.isScriptHashOut());
    });

    it('verify pay to multisig address output', function() {
      var address = new Stealth.Address(multisigAddress);
      var tx = new Stealth.Transaction().to(address, 10000);
      
      var ephemeral = Stealth.Transaction.getEphemeral(tx.outputs[0]);
      var scanKey = new bitcore.PrivateKey(scanKeyMult);
      var spendKeys = spendKeysMult.map(function(k) {
        return new bitcore.PrivateKey(k).publicKey;
      });

      var scannedAddress = Stealth.Address.getMultisigPaymentAddress(ephemeral, scanKey, spendKeys, signatures);
      var paymentAddress = tx.outputs[1].script.toAddress(address.network);

      assert.equal(scannedAddress.toString(), paymentAddress.toString());
    });

    // TODO: Test Networks!!!

  });

});
