'use strict';

var Message = Message || require('./Message');

var RootCerts = require('./common/RootCerts');

var PayPro = require('./common/PayPro');

PayPro.prototype.x509Sign = function(key) {
  var self = this;
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  var details = this.get('serialized_payment_details');
  var type = pki_type.split('+')[1].toUpperCase();

  var trusted = [].concat(pki_data).every(function(cert) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');
    return RootCerts.isTrusted(pem);
  });

  if (!trusted) {
    // XXX Figure out what to do here
    // throw new Error('Unstrusted certificate.');
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
  var details = this.get('serialized_payment_details');
  var buf = this.serializeForSig();
  var type = pki_type.split('+')[1].toUpperCase();

  var verifier = crypto.createVerify('RSA-' + type);
  verifier.update(buf);

  return [].concat(pki_data).every(function(cert) {
    var der = cert.toString('hex');
    var pem = self._DERtoPEM(der, 'CERTIFICATE');

    if (!RootCerts.isTrusted(pem)) {
      // XXX Figure out what to do here
      // throw new Error('Unstrusted certificate.');
    }

    return verifier.verify(pem, sig);
  });
};

// Helpers

PayPro.prototype._PEMtoDER = function(pem) {
  return this._PEMtoDERParam(pem);
};

PayPro.prototype._PEMtoDERParam = function(pem, param) {
  if (Buffer.isBuffer(pem)) {
    pem = pem.toString();
  }
  var start = new RegExp('(?=-----BEGIN ' + (param || '[^-]+') + '-----)', 'i');
  var end = new RegExp('^-----END ' + (param || '[^-]+') + '-----$', 'gmi');
  pem = pem.replace(end, '');
  var parts = pem.split(start);
  return parts.map(function(part) {
    var type = /-----BEGIN ([^-]+)-----/.exec(part)[1];
    part = part.replace(/-----BEGIN ([^-]+)-----/g, '');
    part = part.replace(/\s+/g, '');
    if (!param || type !== param) return;
    return new Buffer(part, 'base64');
  }).filter(Boolean);
};

PayPro.prototype._DERtoPEM = function(der, type) {
  if (typeof der === 'string') {
    der = new Buffer(der, 'hex');
  }
  var type = type || 'UNKNOWN';
  der = der.toString('base64');
  der = der.replace(/(.{64})/g, '$1\r\n');
  der = der.replace(/\r\n$/, '');
  return ''
    + '-----BEGIN ' + type + '-----\r\n'
    + der
    + '\r\n-----END ' + type + '-----\r\n';
};

module.exports = PayPro;
