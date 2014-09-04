'use strict';

var crypto = require('crypto');

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js/rfc/3280');

PayPro.prototype.x509Sign = function(key, returnTrust) {
  var self = this;
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data');
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var details = this.get('serialized_payment_details');
  var type = pki_type !== 'none'
    ? pki_type.split('+')[1].toUpperCase()
    : pki_type;

  if (type !== 'none') {
    var signature = crypto.createSign('RSA-' + type);
    var buf = this.serializeForSig();
    signature.update(buf);
    var sig = signature.sign(key);
  } else {
    var buf = this.serializeForSig();
    var sig = '';
  }

  if (returnTrust) {
    var cert = pki_data[pki_data.length - 1];
    var der = cert.toString('hex');
    var pem = PayPro.DERtoPEM(der, 'CERTIFICATE');
    var caName = RootCerts.getTrusted(pem);
    var selfSigned = 0;
    if (!caName) {
      selfSigned = pki_data.length > 1
        ? -1
        : 1;
    }
    return {
      selfSigned: selfSigned,
      isChain: pki_data.length > 1,
      signature: sig,
      caTrusted: !!caName,
      caName: caName || null
    };
  }

  return sig;
};

PayPro.prototype.x509Verify = function(returnTrust) {
  var self = this;
  var pki_type = this.get('pki_type');
  var sig = this.get('signature');
  var pki_data = this.get('pki_data');
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var details = this.get('serialized_payment_details');
  var buf = this.serializeForSig();
  var type = pki_type !== 'none'
    ? pki_type.split('+')[1].toUpperCase()
    : pki_type;

  if (type !== 'none') {
    var verifier = crypto.createVerify('RSA-' + type);
    verifier.update(buf);
    var signedCert = pki_data[0];
    var der = signedCert.toString('hex');
    var pem = PayPro.DERtoPEM(der, 'CERTIFICATE');
    var verified = verifier.verify(pem, sig);
  } else {
    var verified = true;
  }

  var chain = pki_data;

  //
  // Get the CA cert's name
  //
  var issuer = chain[chain.length - 1];
  der = issuer.toString('hex');
  pem = PayPro.DERtoPEM(der, 'CERTIFICATE');
  var caName = RootCerts.getTrusted(pem);

  if (chain.length === 1 && !caName) {
    if (returnTrust) {
      return {
        selfSigned: 1, // yes
        isChain: false,
        verified: verified,
        caTrusted: false,
        caName: null,
        chainVerified: false
      };
    }
    return verified;
  }

  // If there's no trusted root cert, don't
  // bother validating the cert chain.
  if (!caName) {
    if (returnTrust) {
      return {
        selfSigned: -1, // unknown
        isChain: chain.length > 1,
        verified: verified,
        caTrusted: false,
        caName: null,
        chainVerified: false
      };
    }
    return verified;
  }

  var chainVerified = PayPro.verifyCertChain(chain, type);

  if (returnTrust) {
    return {
      selfSigned: 0, // no
      isChain: true,
      verified: verified,
      caTrusted: !!caName,
      caName: caName || null,
      chainVerified: chainVerified
    };
  }

  return verified && chainVerified;
};

PayPro.verifyCertChain = function(chain, sigHashAlg) {
  if (sigHashAlg === 'none') {
    return true;
  }
  return chain.every(function(cert, i) {
    var der = cert.toString('hex');
    var pem = PayPro.DERtoPEM(der, 'CERTIFICATE');
    var name = RootCerts.getTrusted(pem);

    var ncert = chain[i + 1];
    // The root cert, check if it's trusted:
    if (!ncert || name) {
      if (!name) {
        return false;
      }
      chain.length = 0;
      return true;
    }
    var nder = ncert.toString('hex');
    var npem = PayPro.DERtoPEM(nder, 'CERTIFICATE');

    //
    // Get Public Key from next certificate:
    //
    var ndata = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(ndata, 'der');
    var npubKeyAlg = PayPro.getAlgorithm(
      nc.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);
    var npubKey = nc.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey.data;
    npubKey = PayPro.DERtoPEM(npubKey, npubKeyAlg + ' PUBLIC KEY');

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

    // Get the raw DER TBSCertificate
    // from the DER Certificate:
    var tbs = PayPro.getTBSCertificate(data);

    var verifier = crypto.createVerify('RSA-' + sigHashAlg);
    verifier.update(tbs);
    var sigVerified = verifier.verify(npubKey, sig);

    return validityVerified
      && issuerVerified
      && sigVerified;
  });
};

module.exports = PayPro;
