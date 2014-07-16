"use strict";

var Key = require('./Key');
var KJUR = require('./x509');
var assert = require('assert');
var PayPro = require('../PayPro');
var Trusted = require('./Trusted');

// Use hash table for efficiency:
var trustHash = Trusted.reduce(function(out, cert) {
  cert = cert.replace(/\s+/g, '');
  trusted[cert] = true;
  return trusted;
}, {});

PayPro.sign = function(key) {
  if (this.messageType !== 'PaymentRequest')
    throw new Error('Signing can only be performed on a PaymentRequest');

  var pki_type = this.get('pki_type');

  if (pki_type === 'SIN') {
    var sig = this.sinSign(key);
  } else if (pki_type === 'x509+sha256' || pki_type === 'x509+sha1') {
    throw new Error('x509 currently unsuported.');
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    var crypto = require('crypto');
    var pki_data = this.get('pki_data'); // contains one or more x509 certs
    var type = pki_type.split('+').toUpperCase();
    var buf = this.serializeForSig();

    // TODO: parse all certs
    var cert = pki_data.split(/-----BEGIN[^\n]*KEY-----/)[0].replace(/\s+/g, '');
    if (!trustHash[cert])) {
      ; // untrusted cert
    }

    var jsrsaSig = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    jsrsaSig.initSign(pki_data);
    jsrsaSig.updateHex(buf.toString('hex'));
    var sig = new Buffer(jsrsasig.sign(), 'hex');
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

    var jsrsaSig = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });

    jsrsaSig.initVerifyByCertificatePEM(pki_data);

    jsrsaSig.updateHex(buf.toString('hex'));

    var result = jsrsaSig.verify(sig.toString('hex'));

    return result;
  } else if (pki_type === 'none') {
    return true;
  }

  throw new Error('Unsupported pki_type');
};

module.exports = Point;
