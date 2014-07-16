'use strict';

var chai = chai || require('chai');
var should = chai.should();
var expect = chai.expect;
var bitcore = bitcore || require('../bitcore');
var fs = require('fs');

var PayPro = bitcore.PayPro;
var Key = bitcore.Key;

describe('PayPro', function() {

  it('should be able to create class', function() {
    should.exist(PayPro);
  });

  describe('#Output', function() {

    it('should not fail', function() {
      var obj = {};
      var output = new PayPro.Output();
      output.$set('amount', 20);
    });

    it('should be able to set the amount of an output', function() {
      var output = new PayPro.Output();
      output.set('amount', 20);
      output.get('amount').toInt().should.equal(20);
    });

  });

  describe('#PaymentDetails', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
    });

    it('should set the memo', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
      pd.set('memo', 'test memo');
      pd.get('memo').should.equal('test memo');
    });

    it('should serialize', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      pd.set('memo', 'test memo');
      var hex = pd.toHex();
      hex.length.should.be.greaterThan(0);
    });

  });

  describe('#PaymentRequest', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.PaymentRequest();
    });

    it('should serialize', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var pr = new PayPro.PaymentRequest();
      pr.set('serialized_payment_details', pdbuf);
      var prhex = pr.toHex();
      prhex.length.should.be.greaterThan(0);
    });

  });

  describe('#Payment', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.Payment();
    });

    it('should serialize', function() {
      var obj = {};
      var p = new PayPro.Payment();
      p.set('memo', 'this is a memo');
      p.get('memo').should.equal('this is a memo');
      var phex = p.toHex();
      phex.length.should.be.greaterThan(0);
    });

  });

  describe('#PaymentACK', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.PaymentACK();
    });

    it('should serialize', function() {
      var obj = {};
      var p = new PayPro.Payment();
      var pa = new PayPro.PaymentACK();
      pa.set('payment', p);
      pa.set('memo', 'this is a memo');
      pa.get('memo').should.equal('this is a memo');
      var pahex = pa.toHex();
      pahex.length.should.be.greaterThan(0);
    });

  });

  describe('#X509Certificates', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.X509Certificates();
    });

    it('should serialize', function() {
      var obj = {};
      var x = new PayPro.X509Certificates();
      var fakecertificate = new Buffer([0, 0, 0, 0]);
      x.set('certificate', [fakecertificate]);
      var xhex = x.toHex();
      xhex.length.should.be.greaterThan(0);
    });

  });

  describe('#isValidSize', function() {

    it('should return true for validly sized payment', function() {
      var paypro = new PayPro();
      paypro.makePayment();
      paypro.set('memo', 'test memo');
      paypro.isValidSize().should.equal(true);
    });

  });

  describe('#getContentType', function() {

    it('should get a content type for payment', function() {
      var paypro = new PayPro();
      paypro.makePayment();
      paypro.set('memo', 'test memo');
      paypro.getContentType().should.equal('application/bitcoin-payment');
    });

  });

  describe('#set', function() {

    it('should set a field', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.get('memo').should.equal('test memo');
    });

  });

  describe('#get', function() {

    it('should get a field', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.get('memo').should.equal('test memo');
    });

  });

  describe('#setObj', function() {

    it('should set properties of paymentdetails', function() {
      var pd = new PayPro.PaymentDetails();
      var paypro = new PayPro();
      paypro.messageType = "PaymentDetails";
      paypro.message = pd;
      paypro.setObj({
        time: 0
      });
      paypro.get('time').should.equal(0);
    });

  });

  describe('#serializeForSig', function() {

    it('should serialize a PaymentRequest and not fail', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      var buf = paypro.serializeForSig();
      buf.length.should.be.greaterThan(0);
    });

  });

  describe('#serialize', function() {

    it('should serialize', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.set('time', 0);
      var buf = paypro.serialize();
      buf.length.should.be.greaterThan(0);
      Buffer.isBuffer(buf).should.equal(true);
    });

  });

  describe('#deserialize', function() {

    it('should deserialize a serialized message', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.set('time', 0);
      var buf = paypro.serialize();
      var paypro2 = new PayPro();
      paypro2.deserialize(buf, 'PaymentDetails');
      paypro2.get('memo').should.equal('test memo');
      paypro2.get('time').should.equal(0);
    });

  });

  describe('#sign', function() {

    it('should sign a payment request', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      paypro.sign(key);
      var sig = paypro.get('signature');
      sig.length.should.be.greaterThan(0);
    });

  });

  describe('#verify', function() {

    it('should verify a signed payment request', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      paypro.sign(key);
      var verify = paypro.verify();
      verify.should.equal(true);
    });

  });

  describe('#sinSign', function() {

    it('should sign assuming pki_type is SIN', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      var sig = paypro.sinSign(key);
      sig.length.should.be.greaterThan(0);
    });

  });

  describe('#sinVerify', function() {

    it('should verify assuming pki_type is SIN', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      paypro.sign(key);
      var verify = paypro.sinVerify();
      verify.should.equal(true);
    });

  });

  var x509sig = new Buffer(0);
  var x509path = __dirname + '/data/x509.pem';
  var x509pem = fs.readFileSync(x509path);

  describe('#x509Sign', function() {
    it('should sign assuming pki_type is x509', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');
      paypro.set('pki_data', x509pem);

      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();

      paypro.sign(key);

      var sig = paypro.get('signature');
      x509sig = sig;
      sig.length.should.be.greaterThan(0);
    });
  });

  describe('#x509Verify', function() {
    it('should verify assuming pki_type is x509', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      paypro.set('signature', x509sig); // sig buffer
      paypro.set('pki_data', x509pem); // contains one or more x509 certs

      var verify = paypro.verify();
      verify.should.equal(true);
    });

  });
});
