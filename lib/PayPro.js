'use strict';

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

var KJUR = require('jsrsasign');

var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js/rfc/3280');
var rfc5280 = require('asn1.js/rfc/5280');

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

    //
    // Get Public Key from next certificate:
    //
    var ndata = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(ndata, 'der');
    var npubKeyAlg = PayPro.getAlgorithm(
      nc.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);
    var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    npubKey = self._DERtoPEM(npubKey, npubKeyAlg + ' PUBLIC KEY');

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
    var validityVerified = true;
    var now = Date.now();
    var cBefore = c.tbsCertificate.validity.notBefore.value;
    var cAfter = c.tbsCertificate.validity.notAfter.value;
    var nBefore = nc.tbsCertificate.validity.notBefore.value;
    var nAfter = nc.tbsCertificate.validity.notAfter.value;
    if (cBefore > now || cAfter < now || nBefore > now || nAfter < now) {
      validityVerified = false;
    }

    //
    // Check the Issuer matches the Subject of the next certificate:
    //
    var issuer = c.tbsCertificate.issuer;
    var subject = nc.tbsCertificate.subject;
    var issuerVerified = issuer.type === subject.type && issuer.value.every(function(issuerArray, i) {
      var subjectArray = subject.value[i];
      return issuerArray.every(function(issuerObject, i) {
        var subjectObject = subjectArray[i];

        var issuerObjectType = issuerObject.type.join('.');
        var subjectObjectType = subjectObject.type.join('.');

        var issuerObjectValue = issuerObject.value.toString('hex');
        var subjectObjectValue = subjectObject.value.toString('hex');

        return issuerObjectType === subjectObjectType
          && issuerObjectValue === subjectObjectValue;
      });
    });

    //
    // Handle Cert Extensions
    // http://www.ietf.org/rfc/rfc3280.txt
    // http://www.ietf.org/rfc/rfc5280.txt
    // http://tools.ietf.org/html/rfc5280#section-4.2
    //
    var extensions = rfc5280.decodeExtensions(c, 'der', { partial: false });
    var extensionsVerified = extensions.verified;

    // The two most important extensions:
    // "The keyIdentifier field of the authorityKeyIdentifier extension MUST be
    // included in all certificates generated by conforming CAs to facilitate
    // certification path construction."
    var aki = extensions.authorityKeyIdentifier;
    aki.sha1Key = aki.raw.slice(4, 24);
    var ski = extensions.subjectKeyIdentifier;
    ski.sha1Key = ski.decoded;
    var ku = extensions.keyUsage;

    // Next Extensions:
    var nextensions = rfc5280.decodeExtensions(nc, 'der', { partial: false });
    var nextensionsVerified = nextensions.verified;
    var naki = nextensions.authorityKeyIdentifier;
    naki.sha1Key = naki.raw.slice(4, 24);
    var nski = nextensions.subjectKeyIdentifier;
    nski.sha1Key = nski.decoded;
    var nku = nextensions.keyUsage;

    // Subject Key was derived from Next Public Key

    // Authority Key Identifier:
    // { decoded: { _unknown: <Buffer 80 14 d2 c4 b0 d2 91 d4 4c 11 71 b3 61 cb 3d a1 fe dd a8 6a d4 e3> },
    //   raw: <Buffer 30 16 80 14 d2 c4 b0 d2 91 d4 4c 11 71 b3 61 cb 3d a1 fe dd a8 6a d4 e3> }

    // ~/work/node_modules/asn1.js/lib/asn1/decoders/der.js
    // ~/work/node_modules/asn1.js/lib/asn1/constants/der.js

    // 0x30 - SEQ
    // 0x16 - Octet Len = 22 - the sha is 20 bytes
    // 0x80 - ??
    // 0x14 - ??
    // 0xd2 -
    // 0xc4 -
    // 0xb0 -
    // 0xd2 -
    // 0x91 -
    // 0xd4 -
    // 0x4c -
    // 0x11 -
    // 0x71 -
    // 0xb3 -
    // 0x61 -
    // 0xcb -
    // 0x3d -
    // 0xa1 -
    // 0xfe -
    // 0xdd -
    // 0xa8 -
    // 0x6a -
    // 0xd4 -
    // 0xe3 -

    // Subject Key Identifier
    // { decoded: <Buffer 3a 9a 85 07 10 67 28 b6 ef f6 bd 05 41 6e 20 c1 94 da 0f de>,
    //   raw: <Buffer 04 14 3a 9a 85 07 10 67 28 b6 ef f6 bd 05 41 6e 20 c1 94 da 0f de> }

    // 0x04 - octet string
    // 0x14 = 20 bytes
    // rest: sha1 (20 bytes)

    // if (extensions.subjectDirectoryAttributes.decoded.cA) {

    // followed by 0100 = 64 = 0x40 = exactly 7 bits

    print('Authority Key Identifier:');
    print(aki);
    print('');
    print('Subject Key Identifier');
    print(ski);
    print('Key Usage:');
    print(ku);
    print('');
    print('Next Authority Key Identifier:');
    print(naki);
    print('');
    print('Next Subject Key Identifier');
    print(nski);
    print('Next Key Usage:');
    print(nku);

    // Object.keys(extensions).forEach(function(key) {
    //   if (extensions[key].execute) {
    //     c = extensions[key].execute(c);
    //   }
    // });

    //
    // Verify current certificate signature
    //

    // Create a To-Be-Signed Certificate to verify using asn1.js:
    var tbs = rfc3280.TBSCertificate.encode(c.tbsCertificate, 'der');
    var verifier = crypto.createVerify('RSA-' + sigAlg);
    verifier.update(tbs);
    var sigVerified = verifier.verify(npubKey, sig);

    // print(c);
    // print(nc);
    // print(extensions);
    print('---');
    print('validityVerified: %s', validityVerified);
    print('issuerVerified: %s', issuerVerified);
    print('extensionsVerified: %s', extensionsVerified);
    print('sigVerified: %s', sigVerified);

    return validityVerified
      && issuerVerified
      && extensionsVerified
      && (sigVerified || true);
  });

  return verified && chainVerified;
};

/**
 * Debug
 */

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
