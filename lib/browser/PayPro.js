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
  // 4. XXX What to do when the certificate is revoked?

  var blen = +type.replace(/[^\d]+/g, '');
  if (blen === 1) blen = 20;
  if (blen === 256) blen = 32;

  chain.forEach(function(cert, i) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
    var name = RootCerts.getTrusted(pem);

    var ncert = chain[i + 1];
    // The root cert, check if it's trusted:
    if (!ncert || name) {
      if (!name) {
        // console.log('Untrusted certificate.');
      } else {
        // console.log('Certificate: %s', name);
      }
      return;
    }
    var nder = ncert.toString('hex');
    var npem = KJUR.asn1.ASN1Util.getPEMStringFromHex(nder, 'CERTIFICATE');

    // get sig from current cert - BAD
    var sig = der.slice(-(blen * 2));

    // Should work but doesn't:
    // get sig from current cert
    // var o = new KJUR.asn1.cms.SignerInfo();
    // o.setSignerIdentifier(pem);
    // var sig = new Buffer(o.getEncodedHex(), 'hex');

    // get public key from next cert
    var js = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    js.initVerifyByCertificatePEM(npem);
    var npubKey = KJUR.KEYUTIL.getPEM(js.pubKey);

    var jsrsaSig = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    jsrsaSig.initVerifyByPublicKey(npubKey);
    // NOTE: We need to slice off the signatureAlgorithm and signatureValue -
    // consult the x509 spec:
    // https://www.ietf.org/rfc/rfc2459
    jsrsaSig.updateHex(der);
    var v = jsrsaSig.verify(sig);
    if (!v) {
      // console.log(i + ' not verified.');
      verified = false;
    }
  });

  return verified;
};

module.exports = PayPro;
