'use strict';

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

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

/*
  var anchor = rfc3280.Certificate.decode(
    new Buffer(chain[0].toString('hex'), 'hex'), 'der');
  var anSigAlg = PayPro.getAlgorithm(anchor.signatureAlgorithm.algorithm, 1);
  var anSig = anchor.signature.data;

  var ca = rfc3280.Certificate.decode(
    new Buffer(chain[chain.length - 1].toString('hex'), 'hex'), 'der');
  var caPubKeyAlg = PayPro.getAlgorithm(
    ca.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);
  var caPubKey = ca.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
  caPubKey = self._DERtoPEM(caPubKey, caPubKeyAlg + ' PUBLIC KEY');
*/

  // Verifying the cert chain:
  // 1. Extract public key from next certificate.
  // 2. Extract signature from current certificate.
  // 3. If current cert is not trusted, verify that the current cert is signed
  //    by NEXT by the certificate.
  // NOTE: What to do when the certificate is
  // revoked -> Hit CRL Distribution Points URL

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
    //
    var extensions = rfc5280.decodeExtensions(c, 'der', { partial: false });
    var extensionsVerified = extensions.verified;

    // The two most important extensions:
    // "The keyIdentifier field of the authorityKeyIdentifier extension MUST be
    // included in all certificates generated by conforming CAs to facilitate
    // certification path construction."
    // var aki = extensions.authorityKeyIdentifier;
    // aki.sha1Key = aki.raw.slice(4, 24);
    // var ski = extensions.subjectKeyIdentifier;
    // ski.sha1Key = ski.decoded;
    // var ku = extensions.keyUsage;

    // Next Extensions:
    // var nextensions = rfc5280.decodeExtensions(nc, 'der', { partial: false });
    // var nextensionsVerified = nextensions.verified;
    // var naki = nextensions.authorityKeyIdentifier;
    // naki.sha1Key = naki.raw.slice(4, 24);
    // var nski = nextensions.subjectKeyIdentifier;
    // nski.sha1Key = nski.decoded;
    // var nku = nextensions.keyUsage;

    // Object.keys(extensions).forEach(function(key) {
    //   if (extensions[key].execute) {
    //     c = extensions[key].execute(c);
    //   }
    // });

    //
    // Verify current certificate signature
    //

    // Create a To-Be-Signed Certificate to verify using asn1.js:
    //var tbs = rfc3280.TBSCertificate.encode(c.tbsCertificate, 'der');
    var start = 0;
    var starts = 0;
    for (var start = 0; start < data.length; start++) {
      if (starts === 1 && data[start] === 48) {
        break;
      }
      if (starts < 1 && data[start] === 48) {
        starts++;
      }
    }

    var end = 0;
    var ends = 0;
    for (var end = data.length - 1; end > 0; end--) {
      if (ends === 2 && data[end] === 48) {
        break;
      }
      if (ends < 2 && data[end] === 0) {
        ends++;
      }
    }

    console.log(Array.prototype.slice.call(data.slice(1040)));
    console.log(Array.prototype.slice.call(data.slice(0, 10)));
    console.log(data[1039]);

    // start: 4
    // end: 1040
    /*
    for (var start = 0; start < data.length; start++) {
      for (var end = 0; end < data.length + 1; end++) {
        var tbs = data.slice(start, end);
        var verifier = crypto.createVerify('RSA-' + sigAlg);
        verifier.update(tbs);
        var sigVerified = verifier.verify(npubKey, sig);
        if (sigVerified) {
          console.log('start: %d', start);
          console.log('end: %d', end);
        }
      }
    }
    */

    var tbs = data.slice(start, end);

    var verifier = crypto.createVerify('RSA-' + sigAlg);
    verifier.update(tbs);
    var sigVerified = verifier.verify(npubKey, sig);

    console.log('sigVerified: %s', sigVerified);

    return validityVerified
      && issuerVerified
      && extensionsVerified
      && sigVerified;
  });

  console.log('verified && chainVerified:', verified && chainVerified);

  return verified && chainVerified;
};

module.exports = PayPro;
