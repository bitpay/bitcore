'use strict';

var bitcore = require('bitcore-lib');
var protobufjs = require('protobufjs/dist/protobuf');
var RootCerts = require('./rootcerts');
var rfc5280 = require('asn1.js-rfc5280');

var PublicKey = bitcore.PublicKey;
var PrivateKey = bitcore.PrivateKey;
var Signature = bitcore.crypto.Signature;
var ECDSA = bitcore.crypto.ECDSA;
var sha256sha256 = bitcore.crypto.Hash.sha256sha256;
var varintBufNum = bitcore.encoding.BufferWriter.varintBufNum;

// BIP 70 - payment protocol
function PaymentProtocol(currency) {
  this.messageType = null;
  this.message = null;
  this.currency = currency || 'BTC';
}

PaymentProtocol.PAYMENT_REQUEST_MAX_SIZE = 50000;
PaymentProtocol.PAYMENT_MAX_SIZE = 50000;
PaymentProtocol.PAYMENT_ACK_MAX_SIZE = 60000;

PaymentProtocol.JSON_PAYMENT_REQUEST_CONTENT_TYPE = 'application/payment-request';
PaymentProtocol.JSON_PAYMENT_CONTENT_TYPE = 'application/payment';
PaymentProtocol.JSON_PAYMENT_ACK_CONTENT_TYPE = 'application/payment-ack';

PaymentProtocol.LEGACY_PAYMENT = {
  BTC: {},
  BCH: {}
};

PaymentProtocol.LEGACY_PAYMENT.BTC.REQUEST_CONTENT_TYPE = 'application/bitcoin-paymentrequest';
PaymentProtocol.LEGACY_PAYMENT.BTC.CONTENT_TYPE = 'application/bitcoin-payment';
PaymentProtocol.LEGACY_PAYMENT.BTC.ACK_CONTENT_TYPE = 'application/bitcoin-paymentack';

PaymentProtocol.LEGACY_PAYMENT.BCH.REQUEST_CONTENT_TYPE = 'application/bitcoincash-paymentrequest';
PaymentProtocol.LEGACY_PAYMENT.BCH.CONTENT_TYPE = 'application/bitcoincash-payment';
PaymentProtocol.LEGACY_PAYMENT.BCH.ACK_CONTENT_TYPE = 'application/bitcoincash-paymentack';

// https://www.google.com/search?q=signatureAlgorithm+1.2.840.113549.1.1.1
// http://msdn.microsoft.com/en-us/library/windows/desktop/aa379057(v=vs.85).aspx
PaymentProtocol.X509_ALGORITHM = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.2': 'RSA_MD2',
  '1.2.840.113549.1.1.4': 'RSA_MD5',
  '1.2.840.113549.1.1.5': 'RSA_SHA1',
  '1.2.840.113549.1.1.11': 'RSA_SHA256',
  '1.2.840.113549.1.1.12': 'RSA_SHA384',
  '1.2.840.113549.1.1.13': 'RSA_SHA512',

  '1.2.840.10045.4.3.2': 'ECDSA_SHA256',
  '1.2.840.10045.4.3.3': 'ECDSA_SHA384',
  '1.2.840.10045.4.3.4': 'ECDSA_SHA512'
};

PaymentProtocol.getAlgorithm = function(value, index) {
  if (Array.isArray(value)) {
    value = value.join('.');
  }
  value = PaymentProtocol.X509_ALGORITHM[value];
  if (typeof(index) !== 'undefined') {
    value = value.split('_');
    if (index === true) {
      return {
        cipher: value[0],
        hash: value[1]
      };
    }
    return value[index];
  }
  return value;
};

// Grab the raw DER To-Be-Signed Certificate
// from a DER Certificate to verify
PaymentProtocol.getTBSCertificate = function(data, sig) {
  if (sig == null) {
    sig = rfc5280.Certificate.decode(data, 'der').signature.data;
  }

  // We start by slicing off the first SEQ of the
  // Certificate (TBSCertificate is its own SEQ).

  // The first 10 bytes usually look like:
  // [ 48, 130, 5, 32, 48, 130, 4, 8, 160, 3 ]
  var start = 0;
  var starts = 0;
  for (start = 0; start < data.length; start++) {
    if (starts === 1 && data[start] === 48) {
      break;
    }
    if (starts < 1 && data[start] === 48) {
      starts++;
    }
  }

  // The bytes *after* the TBS (including the last TBS byte) will look like
  // (note the 48 - the start of the sig, and the 122 - the end of the TBS):
  // [ 122, 48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 11, 5, 0, 3, ... ]

  // The certificate in these examples has a `start` of 4, and an `end` of
  // 1040. The 4 bytes is the DER SEQ of the Certificate, right before the
  // SEQ of the TBSCertificate.
  var end = 0;
  var ends = 0;
  for (end = data.length - 1 - sig.length; end > 0; end--) {
    if (ends === 2 && data[end] === 48) {
      break;
    }
    if (ends < 2 && data[end] === 0) {
      ends++;
    }
  }

  // Return our raw DER TBSCertificate:
  return data.slice(start, end);
};

// Check Validity of Certificates
PaymentProtocol.validateCertTime = function(c, nc) {
  var validityVerified = true;
  var now = Date.now();
  var cBefore = c.tbsCertificate.validity.notBefore.value;
  var cAfter = c.tbsCertificate.validity.notAfter.value;
  var nBefore = nc.tbsCertificate.validity.notBefore.value;
  var nAfter = nc.tbsCertificate.validity.notAfter.value;
  if (cBefore > now || cAfter < now || nBefore > now || nAfter < now) {
    validityVerified = false;
  }
  return validityVerified;
};

// Check the Issuer matches the Subject of the next certificate:
PaymentProtocol.validateCertIssuer = function(c, nc) {
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

      return issuerObjectType === subjectObjectType && issuerObjectValue === subjectObjectValue;
    });
  });
  return issuerVerified;
};

PaymentProtocol.RootCerts = RootCerts;

PaymentProtocol.proto = {};

PaymentProtocol.proto.Output = 'message Output {\
  optional uint64 amount = 1 [default = 0];\
  optional bytes script = 2;\
}\n';

PaymentProtocol.proto.PaymentDetails = 'message PaymentDetails {\
  optional string network = 1 [default = \"main\"];\
  repeated Output outputs = 2;\
  required uint64 time = 3;\
  optional uint64 expires = 4;\
  optional string memo = 5;\
  optional string payment_url = 6;\
  optional bytes merchant_data = 7;\
  optional float required_fee_rate = 8;\
}\n';

PaymentProtocol.proto.PaymentRequest = 'message PaymentRequest {\
  optional uint32 payment_details_version = 1 [default = 1];\
  optional string pki_type = 2 [default = \"none\"];\
  optional bytes pki_data = 3;\
  required bytes serialized_payment_details = 4;\
  optional bytes signature = 5;\
}\n';

PaymentProtocol.proto.Payment = 'message Payment {\
  optional bytes merchant_data = 1;\
  repeated bytes transactions = 2;\
  repeated Output refund_to = 3;\
  optional string memo = 4;\
}\n';

PaymentProtocol.proto.PaymentACK = 'message PaymentACK {\
  required Payment payment = 1;\
  optional string memo = 2;\
}\n';

PaymentProtocol.proto.X509Certificates = 'message X509Certificates {\
  repeated bytes certificate = 1;\
}\n';

PaymentProtocol.proto.all = '';
PaymentProtocol.proto.all = PaymentProtocol.proto.all + PaymentProtocol.proto.Output;
PaymentProtocol.proto.all = PaymentProtocol.proto.all + PaymentProtocol.proto.PaymentDetails;
PaymentProtocol.proto.all = PaymentProtocol.proto.all + PaymentProtocol.proto.PaymentRequest;
PaymentProtocol.proto.all = PaymentProtocol.proto.all + PaymentProtocol.proto.Payment;
PaymentProtocol.proto.all = PaymentProtocol.proto.all + PaymentProtocol.proto.PaymentACK;
PaymentProtocol.proto.all = PaymentProtocol.proto.all + PaymentProtocol.proto.X509Certificates;

PaymentProtocol.builder = protobufjs.loadProto(PaymentProtocol.proto.all);

PaymentProtocol.Output = PaymentProtocol.builder.build('Output');
PaymentProtocol.PaymentDetails = PaymentProtocol.builder.build('PaymentDetails');
PaymentProtocol.PaymentRequest = PaymentProtocol.builder.build('PaymentRequest');
PaymentProtocol.Payment = PaymentProtocol.builder.build('Payment');
PaymentProtocol.PaymentACK = PaymentProtocol.builder.build('PaymentACK');
PaymentProtocol.X509Certificates = PaymentProtocol.builder.build('X509Certificates');

PaymentProtocol.prototype.makeOutput = function(obj) {
  this.messageType = 'Output';
  this.message = new PaymentProtocol.Output();
  this.setObj(obj);
  return this;
};

PaymentProtocol.prototype.makePaymentDetails = function(obj) {
  this.messageType = 'PaymentDetails';
  this.message = new PaymentProtocol.PaymentDetails();
  this.setObj(obj);
  return this;
};

PaymentProtocol.prototype.makePaymentRequest = function(obj, currency) {
  this.messageType = 'PaymentRequest';
  this.message = new PaymentProtocol.PaymentRequest();
  this.currency = this.currency || currency || 'BTC';
  this.setObj(obj);
  return this;
};

PaymentProtocol.prototype.makePayment = function(obj, currency) {
  this.messageType = 'Payment';
  this.message = new PaymentProtocol.Payment();
  this.currency = this.currency || currency || 'BTC';
  this.setObj(obj);
  return this;
};

PaymentProtocol.prototype.makePaymentACK = function(obj, currency) {
  this.messageType = 'PaymentACK';
  this.message = new PaymentProtocol.PaymentACK();
  this.currency = currency || 'BTC';
  this.setObj(obj);
  return this;
};

PaymentProtocol.prototype.makeX509Certificates = function(obj) {
  this.messageType = 'X509Certificates';
  this.message = new PaymentProtocol.X509Certificates();
  this.setObj(obj);
  return this;
};

PaymentProtocol.prototype.isValidSize = function() {
  var s = this.serialize();
  if (this.messageType === 'PaymentRequest') {
    return s.length < PaymentProtocol.PAYMENT_REQUEST_MAX_SIZE;
  }
  if (this.messageType === 'Payment') {
    return s.length < PaymentProtocol.PAYMENT_MAX_SIZE;
  }
  if (this.messageType === 'PaymentACK') {
    return s.length < PaymentProtocol.PAYMENT_ACK_MAX_SIZE;
  }
  return true;
};

PaymentProtocol.prototype.getContentType = function() {
  if (this.messageType === 'PaymentRequest') {
    return PaymentProtocol.LEGACY_PAYMENT[this.currency].REQUEST_CONTENT_TYPE;
  }

  if (this.messageType === 'Payment') {
    return PaymentProtocol.LEGACY_PAYMENT[this.currency].CONTENT_TYPE;
  }

  if (this.messageType === 'PaymentACK') {
    return PaymentProtocol.LEGACY_PAYMENT[this.currency].ACK_CONTENT_TYPE;
  }

  throw new Error('No known content type for this message type');
};

PaymentProtocol.prototype.set = function(key, val) {
  this.message.set(key, val);
  return this;
};

PaymentProtocol.prototype.get = function(key) {
  var v = this.message.get(key);

  if (v === null) {
    return v;
  }

  //protobuf supports longs, javascript naturally does not
  //convert longs (see long.js, e.g. require('long')) to Numbers
  if (typeof v.low !== 'undefined' && typeof v.high !== 'undefined') {
    return v.toInt();
  }

  if (typeof v.toBuffer !== 'undefined') {
    var maybebuf = v.toBuffer();
    return Buffer.isBuffer(maybebuf) ? maybebuf : new Buffer(new Uint8Array(maybebuf));
  }

  return v;
};

PaymentProtocol.prototype.setObj = function(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      var val = obj[key];
      this.message.set(key, val);
    }
  }
  return this;
};

PaymentProtocol.prototype.serializeForSig = function() {
  if (this.messageType !== 'PaymentRequest') {
    throw new Error('serializeForSig is only for PaymentRequest');
  }

  var save = this.message.get('signature');
  this.message.set('signature', new Buffer([]));
  var buf = this.serialize();
  this.message.set('signature', save);
  return buf;
};

PaymentProtocol.prototype.serialize = function() {
  //protobufjs returns either a Buffer or an ArrayBuffer
  //but we always want a Buffer (which browserify understands, browser or no)
  var maybebuf = this.message.toBuffer();
  var buf = (Buffer.isBuffer(maybebuf)) ? maybebuf : new Buffer(new Uint8Array(maybebuf));
  return buf;
};

PaymentProtocol.prototype.deserialize = function(buf, messageType) {
  this.messageType = messageType || this.messageType;
  if (!this.messageType) {
    throw new Error('Must specify messageType');
  }
  this.message = PaymentProtocol[this.messageType].decode(buf);
  return this;
};

PaymentProtocol.prototype.sign = function(key, returnTrust) {
  if (this.messageType !== 'PaymentRequest') {
    throw new Error('Signing can only be performed on a PaymentRequest');
  }

  var pki_type = this.get('pki_type');

  var sig;
  if (pki_type === 'SIN') {
    sig = this.sinSign(key);
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    sig = this.x509Sign(key, returnTrust);
  } else if (pki_type === 'none') {
    return this;
  } else {
    throw new Error('Unsupported pki_type');
  }

  this.set('signature', sig);

  return this;
};

PaymentProtocol.prototype.verify = function(returnTrust) {
  if (this.messageType !== 'PaymentRequest') {
    throw new Error('Verifying can only be performed on a PaymentRequest');
  }

  var pki_type = this.get('pki_type');

  if (pki_type === 'SIN') {
    return this.sinVerify();
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    return this.x509Verify(returnTrust);
  } else if (pki_type === 'none') {
    return true;
  }

  throw new Error('Unsupported pki_type');
};

function magicHash(str) {
  var magicBytes = new Buffer('Bitcoin Signed Message:\n');
  var prefix1 = varintBufNum(magicBytes.length);
  var message = new Buffer(str);
  var prefix2 = varintBufNum(message.length);
  var buf = Buffer.concat([prefix1, magicBytes, prefix2, message]);
  var hash = sha256sha256(buf);
  return hash;
}

//default signing function for prototype.sign
PaymentProtocol.prototype.sinSign = function(privateKey) {
  if (!(privateKey instanceof PrivateKey)) {
    throw new TypeError('Expects an instance of PrivateKey');
  }
  var pubkey = privateKey.toPublicKey().toBuffer();
  this.set('pki_data', pubkey);
  var buf = this.serializeForSig();
  var hash = magicHash(buf);
  var signature = ECDSA.sign(hash, privateKey);
  return signature.toDER();
};

//default verify function
PaymentProtocol.prototype.sinVerify = function() {
  var sig = this.get('signature');
  var pubkey = this.get('pki_data');
  var buf = this.serializeForSig();
  var hash = magicHash(buf);
  var publicKey = PublicKey.fromBuffer(pubkey);
  var signature = new Signature.fromString(sig);
  var verified = ECDSA.verify(hash, signature, publicKey);
  return verified;
};

// Helpers
PaymentProtocol.PEMtoDER =
  PaymentProtocol.prototype._PEMtoDER = function(pem) {
    return this.PEMtoDERParam(pem, 'CERTIFICATE');
  };

PaymentProtocol.PEMtoDERParam =
  PaymentProtocol.prototype._PEMtoDERParam = function(pem, param) {
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
      if (!param || type !== param) {
        return;
      }
      return new Buffer(part, 'base64');
    }).filter(Boolean);
  };

PaymentProtocol.DERtoPEM =
  PaymentProtocol.prototype._DERtoPEM = function(der, type) {
    if (typeof der === 'string') {
      der = new Buffer(der, 'hex');
    }
    type = type || 'PRIVACY-ENHANCED MESSAGE';
    der = der.toString('base64');
    der = der.replace(/(.{64})/g, '$1\r\n');
    der = der.replace(/\r\n$/, '');
    return '' +
      '-----BEGIN ' + type + '-----\r\n' +
      der +
      '\r\n-----END ' + type + '-----\r\n';
  };


PaymentProtocol.completeChainAndGetCA =
  PaymentProtocol.prototype._completeChainAndGetCA = function(chain) {
    var caName, pem, der;
    var issuer = chain[chain.length - 1];
    var nder = issuer.toString('hex');
    var ndata = new Buffer(nder, 'hex');
    var nc = rfc5280.Certificate.decode(ndata, 'der');
    var values = nc.tbsCertificate.issuer.value;
    var l = values.length,
      i = 0;
    while (i++ < l && !caName) {
      var v = values[i];
      if (!v) continue;
      var name = v[0].value.toString().substr(2);

      pem = RootCerts.getCert(name);
      if (!pem)
        pem = RootCerts.getCert(name.replace('Certification Authority', 'CA'));

      // Root Cert found
      if (pem) {
        caName = name;
        der = PaymentProtocol.PEMtoDER(pem)[0];
        chain.push(der);
      }
    }
    return caName;
  };


// Expose RootCerts
PaymentProtocol.getTrusted = RootCerts.getTrusted;
PaymentProtocol.getCert = RootCerts.getCert;
PaymentProtocol.parsePEM = RootCerts.parsePEM;
PaymentProtocol.certs = RootCerts.certs;
PaymentProtocol.trusted = RootCerts.trusted;

module.exports = PaymentProtocol;
