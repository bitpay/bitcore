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

PayPro.prototype.x509Sign = function(key, returnTrust) {
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var type = pki_type !== 'none'
    ? pki_type.split('+')[1].toUpperCase()
    : pki_type;
  var buf = this.serializeForSig();

  var rsa = new KJUR.RSAKey();
  rsa.readPrivateKeyFromPEMString(key.toString());
  key = rsa;

  if (type !== 'none') {
    var jsrsaSig = new KJUR.crypto.Signature({
      alg: type + 'withRSA',
      prov: 'cryptojs/jsrsa'
    });

    jsrsaSig.init(key);

    jsrsaSig.updateHex(buf.toString('hex'));

    var sig = new Buffer(jsrsaSig.sign(), 'hex');
  } else {
    var sig = '';
  }

  if (returnTrust) {
    var cert = pki_data[pki_data.length - 1];
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
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
  var sig = this.get('signature');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data');
  pki_data = PayPro.X509Certificates.decode(pki_data);
  pki_data = pki_data.certificate;
  var buf = this.serializeForSig();
  var type = pki_type !== 'none'
    ? pki_type.split('+')[1].toUpperCase()
    : pki_type;

  if (type !== 'none') {
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
  } else {
    var verified = true;
  }

  var chain = pki_data;

  //
  // Get the CA cert's name
  //
  var issuer = chain[chain.length - 1];
  der = issuer.toString('hex');
  // pem = this._DERtoPEM(der, 'CERTIFICATE');
  pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
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
    // var pem = self._DERtoPEM(der, 'CERTIFICATE');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
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
    // var npem = self._DERtoPEM(nder, 'CERTIFICATE');
    var npem = KJUR.asn1.ASN1Util.getPEMStringFromHex(nder, 'CERTIFICATE');

    //
    // Get Next Certificate:
    //
    var ndata = new Buffer(nder, 'hex');
    var nc = rfc3280.Certificate.decode(ndata, 'der');
    var npubKeyAlg = PayPro.getAlgorithm(
      nc.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm);

    //
    // Get Public Key from next certificate (via KJUR because it's a mess):
    //
    if (sigHashAlg !== 'none') {
      var js = new KJUR.crypto.Signature({
        alg: sigHashAlg + 'withRSA',
        prov: 'cryptojs/jsrsa'
      });
      js.initVerifyByCertificatePEM(npem);
      var npubKey = js.pubKey;
    }
    // XXX Somehow change the pubKey format to npubKeyAlg.

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

    if (sigHashAlg !== 'none') {
      var jsrsaSig = new KJUR.crypto.Signature({
        alg: sigHashAlg + 'withRSA',
        prov: 'cryptojs/jsrsa'
      });
      jsrsaSig.initVerifyByPublicKey(npubKey);

      // Get the raw DER TBSCertificate
      // from the DER Certificate:
      var tbs = PayPro.getTBSCertificate(data);

      jsrsaSig.updateHex(tbs.toString('hex'));

      var sigVerified = jsrsaSig.verify(sig.toString('hex'));
    } else {
      var sigVerified = true;
    }

    return validityVerified
      && issuerVerified
      && sigVerified;
  });
};

module.exports = PayPro;
