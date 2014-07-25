"use strict";

var Key = require('./Key');
var KJUR = require('jsrsasign');
var assert = require('assert');
var PayPro = require('../common/PayPro');
var RootCerts = require('../common/RootCerts');

// Documentation:
// http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.Signature.html#.sign
// http://kjur.github.io/jsrsasign/api/symbols/RSAKey.html

PayPro.prototype.x509Sign = function(key) {
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var type = pki_type.split('+')[1].toUpperCase();
  var buf = this.serializeForSig();

  var trusted = pki_data.map(function(cert) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
    return RootCerts.getTrusted(pem);
  });

  // XXX Figure out what to do here
  if (!trusted.length) {
    // throw new Error('Unstrusted certificate.');
  } else {
    trusted.forEach(function(name) {
      // console.log('Certificate: %s', name);
    });
  }

  var rsa = new KJUR.RSAKey();
  rsa.readPrivateKeyFromPEMString(key.toString());
  key = rsa;

  var jsrsaSig = new KJUR.crypto.Signature({
    alg: type + 'withRSA',
    prov: 'cryptojs/jsrsa'
  });

  jsrsaSig.init(key);

  jsrsaSig.updateHex(buf.toString('hex'));

  var sig = new Buffer(jsrsaSig.sign(), 'hex');
  return sig;
};

PayPro.prototype.x509Verify = function(key) {
  var sig = this.get('signature');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data');
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var buf = this.serializeForSig();
  var type = pki_type.split('+')[1].toUpperCase();

  var jsrsaSig = new KJUR.crypto.Signature({
    alg: type + 'withRSA',
    prov: 'cryptojs/jsrsa'
  });

  return pki_data.every(function(cert) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');

    // XXX Figure out what to do here
    var name = RootCerts.getTrusted(pem);
    if (!name) {
      // throw new Error('Unstrusted certificate.');
    } else {
      // console.log('Certificate: %s', name);
    }

    jsrsaSig.initVerifyByCertificatePEM(pem);

    jsrsaSig.updateHex(buf.toString('hex'));

    return jsrsaSig.verify(sig.toString('hex'));
  });
};

module.exports = PayPro;
