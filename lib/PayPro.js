'use strict';
var protobufjs = protobufjs || require('protobufjs/dist/ProtoBuf');
var Message = Message || require('./Message');

var KJUR = require('jsrsasign');
var RootCerts = require('./RootCerts');

// BIP 70 - payment protocol
function PayPro() {
  this.messageType = null;
  this.message = null;
}

PayPro.PAYMENT_REQUEST_MAX_SIZE = 50000;
PayPro.PAYMENT_MAX_SIZE = 50000;
PayPro.PAYMENT_ACK_MAX_SIZE = 60000;
PayPro.PAYMENT_REQUEST_CONTENT_TYPE = "application/bitcoin-paymentrequest";
PayPro.PAYMENT_CONTENT_TYPE = "application/bitcoin-payment";
PayPro.PAYMENT_ACK_CONTENT_TYPE = "application/bitcoin-paymentack";

PayPro.proto = {};

PayPro.proto.Output = "message Output {\
  optional uint64 amount = 1 [default = 0];\
  optional bytes script = 2;\
}\n";

PayPro.proto.PaymentDetails = "message PaymentDetails {\
  optional string network = 1 [default = \"main\"];\
  repeated Output outputs = 2;\
  required uint64 time = 3;\
  optional uint64 expires = 4;\
  optional string memo = 5;\
  optional string payment_url = 6;\
  optional bytes merchant_data = 7;\
}\n";

PayPro.proto.PaymentRequest = "message PaymentRequest {\
  optional uint32 payment_details_version = 1 [default = 1];\
  optional string pki_type = 2 [default = \"none\"];\
  optional bytes pki_data = 3;\
  required bytes serialized_payment_details = 4;\
  optional bytes signature = 5;\
}\n";

PayPro.proto.Payment = "message Payment {\
  optional bytes merchant_data = 1;\
  repeated bytes transactions = 2;\
  repeated Output refund_to = 3;\
  optional string memo = 4;\
}\n";

PayPro.proto.PaymentACK = "message PaymentACK {\
  required Payment payment = 1;\
  optional string memo = 2;\
}\n";

PayPro.proto.X509Certificates = "message X509Certificates {\
  repeated bytes certificate = 1;\
}\n";

PayPro.proto.all = "";
PayPro.proto.all = PayPro.proto.all + PayPro.proto.Output;
PayPro.proto.all = PayPro.proto.all + PayPro.proto.PaymentDetails;
PayPro.proto.all = PayPro.proto.all + PayPro.proto.PaymentRequest;
PayPro.proto.all = PayPro.proto.all + PayPro.proto.Payment;
PayPro.proto.all = PayPro.proto.all + PayPro.proto.PaymentACK;
PayPro.proto.all = PayPro.proto.all + PayPro.proto.X509Certificates;

PayPro.builder = protobufjs.loadProto(PayPro.proto.all);

PayPro.Output = PayPro.builder.build("Output");
PayPro.PaymentDetails = PayPro.builder.build("PaymentDetails");
PayPro.PaymentRequest = PayPro.builder.build("PaymentRequest");
PayPro.Payment = PayPro.builder.build("Payment");
PayPro.PaymentACK = PayPro.builder.build("PaymentACK");
PayPro.X509Certificates = PayPro.builder.build("X509Certificates");

PayPro.prototype.makeOutput = function(obj) {
  this.messageType = 'Output';
  this.message = new PayPro.Output();
  this.setObj(obj);
  return this;
};

PayPro.prototype.makePaymentDetails = function(obj) {
  this.messageType = 'PaymentDetails';
  this.message = new PayPro.PaymentDetails();
  this.setObj(obj);
  return this;
};

PayPro.prototype.makePaymentRequest = function(obj) {
  this.messageType = 'PaymentRequest';
  this.message = new PayPro.PaymentRequest();
  this.setObj(obj);
  return this;
};

PayPro.prototype.makePayment = function(obj) {
  this.messageType = 'Payment';
  this.message = new PayPro.Payment();
  this.setObj(obj);
  return this;
};

PayPro.prototype.makePaymentACK = function(obj) {
  this.messageType = 'Payment';
  this.message = new PayPro.PaymentACK();
  this.setObj(obj);
  return this;
};

PayPro.prototype.makeX509Certificates = function(obj) {
  this.messageType = 'X509Certificates';
  this.message = new PayPro.X509Certificates();
  this.setObj(obj);
  return this;
};

PayPro.prototype.isValidSize = function() {
  var s = this.serialize();
  if (this.messageType == 'PaymentRequest')
    return s.length < PayPro.PAYMENT_REQUEST_MAX_SIZE;
  if (this.messageType == 'Payment')
    return s.length < PayPro.PAYMENT_MAX_SIZE;
  if (this.messageType == 'PaymentACK')
    return s.length < PayPro.PAYMENT_ACK_MAX_SIZE;
  return true;
};

PayPro.prototype.getContentType = function() {
  if (this.messageType == 'PaymentRequest')
    return PayPro.PAYMENT_REQUEST_CONTENT_TYPE;

  if (this.messageType == 'Payment')
    return PayPro.PAYMENT_CONTENT_TYPE;

  if (this.messageType == 'PaymentACK')
    return PayPro.PAYMENT_ACK_CONTENT_TYPE;

  throw new Error('No known content type for this message type');
};

PayPro.prototype.set = function(key, val) {
  this.message.set(key, val);
  return this;
};

PayPro.prototype.get = function(key) {
  var v = this.message.get(key);

  if (v === null)
    return v;

  //protobuf supports longs, javascript naturally does not
  //convert longs (see long.js, e.g. require('long')) to Numbers
  if (typeof v.low !== 'undefined' && typeof v.high !== 'undefined')
    return v.toInt();

  if (typeof v.toBuffer !== 'undefined') {
    var maybebuf = v.toBuffer();
    return Buffer.isBuffer(maybebuf) ? maybebuf : new Buffer(new Uint8Array(maybebuf));
  }

  return v;
};

PayPro.prototype.setObj = function(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      var val = obj[key];
      this.message.set(key, val);
    }
  }
  return this;
};

PayPro.prototype.serializeForSig = function() {
  if (this.messageType !== 'PaymentRequest')
    throw new Error('serializeForSig is only for PaymentRequest');

  var save = this.message.get('signature');
  this.message.set('signature', new Buffer([]));
  var buf = this.serialize();
  this.message.set('signature', save);
  return buf;
};

PayPro.prototype.serialize = function() {
  //protobufjs returns either a Buffer or an ArrayBuffer
  //but we always want a Buffer (which browserify understands, browser or no)
  var maybebuf = this.message.toBuffer();
  var buf = (Buffer.isBuffer(maybebuf)) ? maybebuf : new Buffer(new Uint8Array(maybebuf));
  return buf;
};

PayPro.prototype.deserialize = function(buf, messageType) {
  this.messageType = messageType || this.messageType;
  if (!this.messageType)
    throw new Error('Must specify messageType');
  this.message = PayPro[this.messageType].decode(buf);
  return this;
};

PayPro.prototype.sign = function(key) {
  if (this.messageType !== 'PaymentRequest')
    throw new Error('Signing can only be performed on a PaymentRequest');

  var pki_type = this.get('pki_type');

  if (pki_type === 'SIN') {
    var sig = this.sinSign(key);
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    var sig = this.x509Sign(key);
  } else if (pki_type === 'none') {
    return this;
  } else {
    throw new Error('Unsupported pki_type');
  }

  this.set('signature', sig);

  return this;
};

PayPro.prototype.verify = function() {
  if (this.messageType !== 'PaymentRequest')
    throw new Error('Verifying can only be performed on a PaymentRequest');

  var pki_type = this.get('pki_type');

  if (pki_type === 'SIN') {
    return this.sinVerify();
  } else if (pki_type === 'x509+sha1' || pki_type === 'x509+sha256') {
    return this.x509Verify();
  } else if (pki_type === 'none') {
    return true;
  }

  throw new Error('Unsupported pki_type');
};

PayPro.prototype.x509Sign = function(key) {
  var crypto = require('crypto');
  var pki_type = this.get('pki_type');
  var pki_data = this.get('pki_data'); // contains one or more x509 certs
  var details = this.get('serialized_payment_details');
  var type = pki_type.split('+')[1].toUpperCase();

  var trusted = [].concat(pki_data).every(function(cert) {
    var der = cert.toString('hex');
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
    // var pem = DERtoPEM(der, 'CERTIFICATE');
    return !!RootCerts[pem.replace(/\s+/g, '')];
  });

  if (!trusted) {
    // throw new Error('Unstrusted certificate.');
  }

  var signature = crypto.createSign('RSA-' + type);
  var buf = this.serializeForSig();
  signature.update(buf);
  var sig = signature.sign(key);
  return sig;
};

PayPro.prototype.x509Verify = function() {
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
    var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
    // var pem = DERtoPEM(der, 'CERTIFICATE');

    if (!RootCerts[pem.replace(/\s+/g, '')]) {
      // throw new Error('Unstrusted certificate.');
    }

    return verifier.verify(pem, sig);
  });
};

//default signing function for prototype.sign
PayPro.prototype.sinSign = function(key) {
  this.set('pki_data', key.public)
  var buf = this.serializeForSig();
  return Message.sign(buf, key);
};

//default verify function
PayPro.prototype.sinVerify = function() {
  var sig = this.get('signature');
  var pubkey = this.get('pki_data');
  var buf = this.serializeForSig();
  return Message.verifyWithPubKey(pubkey, buf, sig);
};

// Helpers

function PEMtoDER(pem) {
  pem = pem.replace(/^-----END [^-]+-----$/gmi, '');
  var parts = pem.split(/-----BEGIN [^-]+-----/);
  return parts.map(function(part) {
    part = part.replace(/\s+/g, '');
    return new Buffer(part, 'base64');
  });
}

function PEMtoDERParam(pem, param) {
  var start = new RegExp('(?=-----BEGIN ' + param + '-----)', 'i');
  var end = new RegExp('^-----END ' + param + '-----$', 'gmi');
  pem = pem.replace(end, '');
  var parts = pem.split(start);
  return parts.map(function(part) {
    part = part.replace(/\s+/g, '');
    var type = /-----BEGIN ([^-]+)-----/.exec(part)[1];
    part = part.replace(/-----BEGIN ([^-]+)-----/g, '');
    if (type !== param) return;
    return new Buffer(part, 'base64');
  }).filter(Boolean);
}

function wrapText(text, cols) {
  var j = 0;
  var part = '';
  var parts = [];
  for (var i = 0; i < text.length; i++) {
    if (j === cols) {
      parts.push(part);
      j = 0;
      part = ''
      continue;
    }
    part += text[i];
    j++;
  }
  var total = parts.join('').length;
  if (total < text.length) {
    parts.push(text.slice(-(text.length - total)));
  }
  return parts.join('\n');
}

function DERtoPEM(der, type) {
  var type = type || 'UNKNOWN';
  return ''
    + '-----BEGIN ' + type + '-----\n'
    + wrapText(der.toString('base64'), 64) + '\n'
    + '-----END ' + type + '-----\n';
}

module.exports = PayPro;
