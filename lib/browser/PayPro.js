"use strict";

var Key = require('./Key');
var KJUR = require('jsrsasign');
var assert = require('assert');
var PayPro = require('../common/PayPro');
var RootCerts = require('../common/RootCerts');

PayPro.prototype.x509Sign = function(key) {
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  var type = pki_type.split('+')[1].toUpperCase();
  var buf = this.serializeForSig();

  var trusted = [].concat(pki_data).every(function(cert) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
    return RootCerts.isTrusted(pem);
  });

  if (!trusted) {
    // XXX Figure out what to do here
    // throw new Error('Unstrusted certificate.');
  }

  var jsrsaSig = new KJUR.crypto.Signature({
    alg: type + 'withRSA',
    prov: 'cryptojs/jsrsa'
  });

  jsrsaSig.initSign(key);

  jsrsaSig.updateHex(buf.toString('hex'));

  var sig = new Buffer(jsrsasig.sign(), 'hex');
  //var sig = new Buffer(new Uint8Array(jsrsasig.sign()), 'hex');
  return sig;
};

PayPro.prototype.x509Verify = function(key) {
  var sig = this.get('signature');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data');
  var buf = this.serializeForSig();
  var type = pki_type.split('+')[1].toUpperCase();

  var jsrsaSig = new KJUR.crypto.Signature({
    alg: type + 'withRSA',
    prov: 'cryptojs/jsrsa'
  });

  return [].concat(pki_data).every(function(cert) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');

    if (!RootCerts.isTrusted(pem)) {
      // XXX Figure out what to do here
      // throw new Error('Unstrusted certificate.');
    }

    jsrsaSig.initVerifyByCertificatePEM(pem);

    jsrsaSig.updateHex(buf.toString('hex'));

    return jsrsaSig.verify(sig.toString('hex'));
  });
};

module.exports = PayPro;
