"use strict";

var Key = require('./Key');
var bignum = require('bignum');
var assert = require('assert');
var elliptic = require('elliptic');
var PayPro = require('../PayPro');

PayPro.sign = function(key) {
  if (this.messageType !== 'PaymentRequest')
    throw new Error('Signing can only be performed on a PaymentRequest');

  var pki_type = this.get('pki_type');

  if (pki_type === 'SIN') {
    var sig = this.sinSign(key);
  } else if (pki_type === 'none' || pki_type === 'x509+sha256' || pki_type === 'x509+sha1') {
    throw new Error('x509 currently unsuported.');
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    // XXX node only
    var crypto = require('crypto');
    var pki_data = this.get('pki_data'); // contains one or more x509 certs
    //var details = this.get('serialized_payment_details');
    var type = pki_type.split('+').toUpperCase();
    // var signature = crypto.createSign('RSA-' + type);
    var buf = this.serializeForSig();
    // signature.update(buf);
    //var hexSig = _rsasign_getHexPaddedDigestInfoForString("aaa", 1024, 'sha1');
    var hexSig = _rsasign_getHexPaddedDigestInfoForString(buf.toString(16), 2048, type);
    // var sig = signature.sign(pki_data);
  } else if (pki_type === 'none') {
    return this;
  } else {
    throw new Error('Unsupported pki_type');
  }


  this.set('signature', sig);
  return this;
};

PayPro.verify = function() {
  if (this.messageType !== 'PaymentRequest')
    throw new Error('Verifying can only be performed on a PaymentRequest');

  var pki_type = this.get('pki_type');

  if (pki_type === 'SIN') {
    return this.sinVerify();
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    var sig = this.get('signature');
    var pki_data = this.get('pki_data');
    var buf = this.serializeForSig();
    var type = pki_type.split('+').toUpperCase();

    // var pubKey = PKCS5PKEY.getRSAKeyFromPublicPKCS8PEM(sKp1PubPEM);
    // var result = pubKey.verifyPSS("aaa", sKp1SigAAA1, "sha1", -1);

    var pubKey = PKCS5PKEY.getRSAKeyFromPublicPKCS8PEM(pki_data);
    var result = pubKey.verifyPSS(buf, buf.toString(16), type, -1);
    return result;

    // var verifier = crypto.createVerify('RSA-' + type);
    // verifier.update(buf);
    // return verifier.verify(pki_data, sig);
  } else if (pki_type === 'none') {
    return true;
  }


  throw new Error('Unsupported pki_type');
};

module.exports = Point;
