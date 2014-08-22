"use strict";

var Key = require('./Key');
var KJUR = require('jsrsasign');
var assert = require('assert');
var PayPro = require('../common/PayPro');
var RootCerts = require('../common/RootCerts');
var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js/rfc/3280');

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

  var signedCert = pki_data[0];
  var der = signedCert.toString('hex');
  var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
  jsrsaSig.initVerifyByCertificatePEM(pem);
  jsrsaSig.updateHex(buf.toString('hex'));
  var verified = jsrsaSig.verify(sig.toString('hex'));

  var chain = pki_data;

  // Verifying the cert chain:
  // 1. Extract public key from next certificate.
  // 2. Extract signature from current certificate.
  // 3. If current cert is not trusted, verify that the current cert is signed
  //    by NEXT by the certificate.
  // NOTE: XXX What to do when the certificate is revoked?

  var chainVerified = chain.every(function(cert, i) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
    var name = RootCerts.getTrusted(pem);

    var ncert = chain[i + 1];
    // The root cert, check if it's trusted:
    if (!ncert || name) {
      if (!ncert && !name) {
        return false;
      }
      chain.length = 0;
      return true;
    }
    var nder = ncert.toString('hex');
    var npem = KJUR.asn1.ASN1Util.getPEMStringFromHex(nder, 'CERTIFICATE');

    // Get public key from next certificate:
    var data = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(data, 'der');
    var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    npubKey = self._DERtoPEM(npubKey, 'RSA PUBLIC KEY');

    // Get signature from current certificate:
    var data = new Buffer(der, 'hex');
    var c = rfc3280.Certificate.decode(data, 'der');
    var sig = c.signature.data;

    var jsrsaSig = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    jsrsaSig.initVerifyByPublicKey(npubKey);

    // Create a To-Be-Signed Certificate to verify using asn1.js:
    // Fails at Issuer:
    var tbs = rfc3280.TBSCertificate.encode(c.tbsCertificate, 'der');
    jsrsaSig.updateHex(tbs);

    return jsrsaSig.verify(sig);
  });

  return verified && chainVerified;
};

module.exports = PayPro;
