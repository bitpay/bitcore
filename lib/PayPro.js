'use strict';

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

var KJUR = require('jsrsasign');

var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js/rfc/3280');

PayPro.prototype.x509Sign = function(key) {
  var self = this;
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var details = this.get('serialized_payment_details');
  var type = pki_type.split('+')[1].toUpperCase();

  var trusted = pki_data.map(function(cert) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');
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

  var signature = crypto.createSign('RSA-' + type);
  var buf = this.serializeForSig();
  signature.update(buf);
  var sig = signature.sign(key);
  return sig;
};

PayPro.prototype.x509Verify = function() {
  var self = this;
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var sig = this.get('signature');
  var pki_data = this.get('pki_data');
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var details = this.get('serialized_payment_details');
  var buf = this.serializeForSig();
  var type = pki_type.split('+')[1].toUpperCase();

  var verifier = crypto.createVerify('RSA-' + type);
  verifier.update(buf);

  var signedCert = pki_data[0];
  var der = signedCert.toString('hex');
  var pem = this._DERtoPEM(der, 'CERTIFICATE');
  var verified = verifier.verify(pem, sig);

  var chain = pki_data;

  // Verifying the cert chain:
  // 1. Extract public key from next certificate.
  // 2. Extract signature from current certificate.
  // 3. If current cert is not trusted, verify that the current cert is signed
  //    by NEXT by the certificate.
  // NOTE: XXX What to do when the certificate is revoked?

  var chainVerified = chain.every(function(cert, i) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');
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
    var npem = self._DERtoPEM(nder, 'CERTIFICATE');

    // Get public key from next certificate:
    var data = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(data, 'der');
    var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    npubKey = self._DERtoPEM(npubKey, 'RSA PUBLIC KEY');

    // Get signature from current certificate:
    var data = new Buffer(der, 'hex');
    var c = rfc3280.Certificate.decode(data, 'der');

    // console.log(c._rawTags);
    // console.log(c._rawTags[0]._rawTags['seq:0']);
    // var tbsData = c._rawTags[0]._rawTags['seq:0'].input.base;
    // console.log(tbsData.toString('hex'));
    // //var tbsData = c._rawTags[0]._baseState.children[0]._rawTags[0].input.base;
    // //console.log(tbsData.toString('hex'));
    // //var tc = rfc3280.TBSCertificate.decode(tbsData, 'der');
    // //console.log(tc);

    var sig = c.signature.data;

    var verifier = crypto.createVerify('RSA-' + type);

    // Create a To-Be-Signed Certificate to verify using asn1.js:
    // Fails at Issuer:
    var tbs = rfc3280.TBSCertificate.encode(c.tbsCertificate, 'der');
    //var tbs = c._rawTags[0]._baseState.children[0]._rawTags[100].input.base.slice(
    //  //c._rawTags[0]._baseState.children[0]._rawTags[100].input.offset
    //  0, c._rawTags[0]._baseState.children[0]._rawTags[100].input.length
    //);
    verifier.update(tbs);

    return verifier.verify(npubKey, sig);
  });

  return verified && chainVerified;
};

module.exports = PayPro;
