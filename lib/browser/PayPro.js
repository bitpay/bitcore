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
  // var pem = self._DERtoPEM(der, 'CERTIFICATE');
  var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
  jsrsaSig.initVerifyByCertificatePEM(pem);
  jsrsaSig.updateHex(buf.toString('hex'));
  var verified = jsrsaSig.verify(sig.toString('hex'));

  var chain = pki_data;

  var chainVerified = chain.every(function(cert, i) {
    var der = cert.toString('hex');
    // var pem = self._DERtoPEM(der, 'CERTIFICATE');
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
    // var npem = self._DERtoPEM(nder, 'CERTIFICATE');
    var npem = KJUR.asn1.ASN1Util.getPEMStringFromHex(nder, 'CERTIFICATE');

    //
    // Get Public Key from next certificate:
    //
    // var ndata = new Buffer(nder, 'hex');
    // var nc = rfc3280.Certificate.decode(ndata, 'der');
    // var npubKeyAlg = PayPro.getAlgorithm(
    //   nc.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);
    // var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    // // npubKey = self._DERtoPEM(npubKey, npubKeyAlg + ' PUBLIC KEY');
    // // npubKey = KJUR.asn1.ASN1Util.getPEMStringFromHex(npubKey.toString('hex'), 'PUBLIC KEY');
    // npubKey = KJUR.asn1.ASN1Util.getPEMStringFromHex(npubKey.toString('hex'), npubKeyAlg + ' PUBLIC KEY');

    // Get public key from next certificate via KJUR since sane methods don't work:
    var js = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    js.initVerifyByCertificatePEM(npem);
    var npubKey = js.pubKey;

    //
    // Get Signature Value from current certificate:
    //
    var data = new Buffer(der, 'hex');
    var c = rfc3280.Certificate.decode(data, 'der');
    var sigAlg = PayPro.getAlgorithm(c.signatureAlgorithm.algorithm, 1);
    var sig = c.signature.data;

    //
    // Check Validity of Certificates
    //
    var validityVerified = PayPro.validateCertTime(c, nc);

    //
    // Check the Issuer matches the Subject of the next certificate:
    //
    var issuerVerified = PayPro.validateCertIssuer(c, nc);

    //
    // Verify current Certificate signature
    //

    var jsrsaSig = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    jsrsaSig.initVerifyByPublicKey(npubKey);

    // Get the raw DER TBSCertificate
    // from the DER Certificate:
    var tbs = PayPro.getTBSCertificate(data);

    jsrsaSig.updateHex(tbs.toString('hex'));

    var sigVerified = jsrsaSig.verify(sig.toString('hex'));

    return validityVerified
      && issuerVerified
      && sigVerified;
  });

  return verified && chainVerified;
};

module.exports = PayPro;
