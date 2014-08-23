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

  if (verified) {
    console.log('PaymentRequest verified (node)');
  } else {
    console.log('PaymentRequest not verified (node)');
  }

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

    //
    // Get Public Key from next certificate:
    //
    var ndata = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(ndata, 'der');
    var npubKeyAlg = PayPro.getAlgorithm(
      nc.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);
    var fnpubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    fnpubKey = self._DERtoPEM(fnpubKey, npubKeyAlg + ' PUBLIC KEY');

    //
    // Get Public Key from next certificate via KJUR:
    //
    var js = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });
    js.initVerifyByCertificatePEM(npem);
    var kjrsapubKey = js.pubKey; // RSAKey
    var kjnpubKey = KJUR.KEYUTIL.getPEM(js.pubKey); // PEM

    //
    // NOTE: The asn1.js pubKey and KJUR pubKey differ for some reason (the
    // KJUR one is not RSA: consult docs, there may be an alternate method).
    //

    //
    // Get Signature Value from current certificate:
    //
    var data = new Buffer(der, 'hex');
    var c = rfc3280.Certificate.decode(data, 'der');
    var sigAlg = PayPro.getAlgorithm(c.signatureAlgorithm.algorithm, 1);
    var sig = c.signature.data;

    // NOTE:
    // CHECK: c.tbsCertificate.issuer === nc.tbsCertificate.subject;

    //
    // Create a To-Be-Signed Certificate to verify using asn1.js:
    //
    // var tbs = rfc3280.TBSCertificate.encode(c.tbsCertificate, 'der');
    var tbs = rfc3280.TBSCertificate.encode({
      version: c.tbsCertificate.version,
      serialNumber: c.tbsCertificate.serialNumber,
      // XXX signature algorithm is different for some reason.
      signature: { algorithm: [ 1, 2, 840, 113549, 1, 1, 11 ] },
      //signature: c.tbsCertificate.signature,
      issuer: c.tbsCertificate.issuer,
      validity: c.tbsCertificate.validity,
      subject: c.tbsCertificate.subject,
      subjectPublicKeyInfo: c.tbsCertificate.subjectPublicKeyInfo,
      extensions: c.tbsCertificate.extensions
    }, 'der');

    //
    // Debug
    //
    // print(c);
    // print(nc);

    //
    // Verify current certificate signature via KJUR:
    //
    // https://github.com/kjur/jsrsasign/wiki/Tutorial-to-sign-and-verify-with-RSAKey-extension
    // http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.html
    // http://kjur.github.io/jsrsasign/api/symbols/KJUR.crypto.Signature.html
    if (0) {
      var jsrsaSig = new KJUR.crypto.Signature({
        alg: sigAlg + 'withRSA',
        prov: 'cryptojs/jsrsa'
      });
      jsrsaSig.initVerifyByPublicKey(kjrsapubKey); // Has to be an RSAKey.
      jsrsaSig.updateHex(tbs.toString('hex'));
      var v = jsrsaSig.verify(sig.toString('hex'));
      if (v) console.log(i + ' verified (KJUR)');
      else console.log(i + ' not verified (KJUR)');
      return true;
      return v;
    }

    //
    // Verify current certificate signature:
    //
    var verifier = crypto.createVerify('RSA-' + sigAlg);
    verifier.update(tbs);
    var v = verifier.verify(fnpubKey, sig);
    //var v = verifier.verify(kjnpubKey, sig);
    if (v) console.log(i + ' verified (node)');
    else console.log(i + ' not verified (node)');
    return true;
    return v;
  });

  return verified && chainVerified;
};

var util = require('util');
function inspect(obj) {
  return typeof obj !== 'string'
    ? util.inspect(obj, false, 20, true)
    : obj;
}
function print(obj) {
  return typeof obj === 'object'
    ? process.stdout.write(inspect(obj) + '\n')
    : console.log.apply(console, arguments);
}

module.exports = PayPro;
