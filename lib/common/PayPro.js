'use strict';

var protobufjs = require('protobufjs/dist/ProtoBuf');
var Message = require('../Message');

var RootCerts = require('../common/RootCerts');

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
  this.messageType = 'PaymentACK';
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
