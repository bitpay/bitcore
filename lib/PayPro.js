'use strict';

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

var KJUR = require('jsrsasign');

var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js/rfc/3280');
var Certificate = rfc3280.Certificate;

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
  // 4. XXX What to do when the certificate is revoked?

  var blen = +type.replace(/[^\d]+/g, '');
  if (blen === 1) blen = 20;
  if (blen === 256) blen = 32;

  chain.forEach(function(cert, i) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');
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
    var npem = self._DERtoPEM(nder, 'CERTIFICATE');

    /*
    https://www.ietf.org/rfc/rfc2459
    https://en.wikipedia.org/wiki/X509
    https://github.com/indutny/asn1.js
    https://github.com/indutny/asn1.js/blob/master/rfc/3280/index.js
    ~/work/node_modules/bitcore/node_modules/asn1.js/rfc/3280/index.js
    Error: Failed to match tag: "objid" at:
    ["tbsCertificate"]["issuerUniqueID"]["subjectUniqueID"]["extensions"]["extnID"]
    PR: https://github.com/indutny/asn1.js/pull/22
    */

    // Get public key from next certificate.
    var data = new Buffer(nder, 'hex');
    var nc = Certificate.decode(data, 'der');
    var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    // Need to convert this to PEM:
    //   Doesn't work because KJUR is terrible:
    //   npubKey = KJUR.KEYUTIL.getPEM(npubKey.toString('hex'));
    npubKey = self._DERtoPEM(npubKey, 'RSA PUBLIC KEY');

    // Get signature from current certificate.
    var data = new Buffer(der, 'hex');
    //var c = Certificate.decode(data, 'der', { partial: true });
    var c = Certificate.decode(data, 'der');
    var sig = c.signature.data;

    var verifier = crypto.createVerify('RSA-' + type);

    var t = c.tbsCertificate;

    // Messy work:
    // Fails on Issuer:
    /*
    var cur = Certificate.encode({
      tbsCertificate: {
        version: t.version,
        serialNumber: t.serialNumber,
        signature: t.signature,
        // Fails on issuer:
        //issuer: t.issuer,
        //issuer: t.issuer.value,
        //issuer: t.issuer.value.map(function(obj) {
        //  return obj.value;
        //}),
        //issuer: t.issuer.type,
        //issuer: 'rdh',
        //issuer: rfc3280.Name.decode(t.issuer, 'der'),
        validity: t.validity,
        subject: t.subject,
        subjectPublicKeyInfo: t.subjectPublicKeyInfo,
        extensions: t.extensions
      },
      signatureAlgorithm: '',
      signature: ''
    }, 'der');
    */

    var cur = Certificate.encode({
      tbsCertificate: c.tbsCertificate,
      signatureAlgorithm: '',
      signature: ''
    }, 'der');

    // console.log(cur);

    // NOTE: We need to slice off the signatureAlgorithm and signatureValue.
    // consult the x509 spec:
    // https://www.ietf.org/rfc/rfc2459
    verifier.update(new Buffer(der, 'hex'));

    var v = verifier.verify(npubKey, sig);
    if (!v) {
      // console.log(i + ' not verified.');
      verified = false;
    }
  });

  return verified;
};

module.exports = PayPro;
