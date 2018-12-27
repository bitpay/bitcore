'use strict';

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var expect = chai.expect;
var bitcore = require('bitcore-lib');
var PrivateKey = bitcore.PrivateKey;
var PublicKey = bitcore.PublicKey;
var KJUR = require('jsrsasign');

var is_browser = process.browser;

var PaymentProtocol = require('../');
var SampleRequest  = require('./samplerequest');

var x509 = {
  priv: ''
    + 'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcEFJQkFBS0NBUUVBeFRKdUsyYUdM'
    + 'bjFkWEpLRGg0TXdQTFVrbDNISTVwR25HNWFjNGwvMGlobXE4Y3dDCitGVlBnWk1TNTlheWtpc0Ir'
    + 'ekM3dnR2a0prL2J2K0JTT1g3b3hkSXN1TDNkS1FGcHVYWFZmcmRiOTV3WW40TSsKL25qRWhYTWxo'
    + 'Vk1IL09DaUFnOUpLaFRLV0w2R1JXWkFBaEE3bEJSaGdTTkRUaVRDNTFDYmlLN3hBNnBONCt0UQpI'
    + 'eG9tSlBYclpSa2JCMmtsT2ZXd2J2OTNZM0oxS0ZEK2kwUE1RSEx3N3JoRXVteEM5MytISFVWWVZI'
    + 'N0gxVFBaCkgxYmRVSkowMmdRZXlsSnNzWUNKeWRaUHpOVC96dXRzL0tKV2RSdjVseHdHOXU5dE1O'
    + 'TWdoSmJtQWFNa01HaSsKbzdQTkV5UDNxSEZyWXBZaHM1cHFMSE1STkI3OFFNOUllTmpMRndJREFR'
    + 'QUJBb0lCQVFERVJyalBiQUdjbmwxaAorZGIrOTczNGZ0aElBUkpWSko1dTRFK1JKcThSRWhGTEVL'
    + 'UFlKNW0yUC94dVZBMXpYV2xnYXhaRUZ6d1VRaUpZCjdsOEpLVjlwSHhReVlaQ1M4dndYZzhpWGtz'
    + 'dndQaWRvQmN1YW4vd0RWQ1FCZXk2VkxjVXpSYUd1Ui9sTHNYK1YKN2Z0QjBvUnFsSXFrYmNQZE1N'
    + 'dnFUeG93UnVoUG11Q3JWVGpPNHBiTnFuU09OUExPaUovRkFYYjJwZnpGZnBCUgpHeCtFTW16d2Ur'
    + 'SEZuSkJHRGhIWjk5bm4vVEJmYUp6TlZDcURZLzNid3o1WDdIUU5ZN1QrSnlUVUZzZVE5NHhzCnpy'
    + 'a2lidGRmVGNUanB1K1VoWm80c1p6Q3IrZkhHWm9FOUdEUHF0ZDRnQ3ByazRFS0pzbXFCRVN4QlhT'
    + 'RGhZZ04KOXBVRDM4c1pBb0dCQU9yZkRqdDZaL0ZDamFuVThXek5GaWYrOVQxQTJ4b013RDVWU2xN'
    + 'dVJyWW1HbGZyMEM5TQpmMUVvZ2l2dVRrYnA3cmtnZFRhWVRTYndmTnFaQkt4Y3R5YzdCaGRwWnhE'
    + 'RVdKa2Z5cThxVngvem1Cek1JK1ZzCjJLYi9hcHZXcmJlb3NET0NyeUg1YzhKc1VUOXhUWDNYYnhF'
    + 'anlPSlFCU1lHRE1qUHlKNkU5czZMQW9HQkFOYnYKd2d0S2Nra0tLbDJhNXZzaGR2RENnNnFLL1Fn'
    + 'T20vNktUSlVKRVNqaHoydFIrZlBWUjcwVEg5UmhoVFJscERXQgpCd3oyU2NCc1RRNDIvTGsxRnky'
    + 'MFQvck12S3VmSEw1VE1BNGZ6NWRxMUxIbmN6ejZVazVnWEtBT09rUjlVdVhpClR0eTNoREcyQkM4'
    + 'Nk1LTVJ4SjUxRWJxam94d0VSMTAwU2FuTVBmTWxBb0dBSUhLY1pyOHNhUHBHMC9XbFBPREEKZE5v'
    + 'V1MxWVFidkxnQkR5SVBpR2doejJRV2lFcjY3em53ZkNVdXpqNiszVUtFKzFXQkNyYVRjemZrdHVj'
    + 'OTZyLwphcDRPNDJFZWFnU1dNT0ZoZ1AyYWQ4R1JmRGovcEl4N0NlY3pkVUFkVThnc1A1R0lYR3M0'
    + 'QU40eUEwL0Y0dUxHCloxbklRT3ZKS2syZnFvWjZNdHd2dEswQ2dZRUFnSjdGTGVDRTkzUmYyZGdD'
    + 'ZFRHWGJZZlpKc3M1bEFLNkV0NUwKNmJ1ZFN5dWw1Z0VPWkgyekNsQlJjZFJSMUFNbSt1V1ZoSW8x'
    + 'cERLckFlQ2g1MnIvemRmakxLQXNIejkrQWQ3aQpHUEdzVmw0Vm5jaDFTMzQ0bHJKUGUzQklLZ2dj'
    + 'L1hncDNTYnNzcHJMY2orT0wyZElrOUpXbzZ1Y3hmMUJmMkwwCjJlbGhBUWtDZ1lCWHN5elZWL1pK'
    + 'cVhOcFdDZzU1TDNVRm9UTHlLU3FsVktNM1dpRzVCS240QWF6VkNITCtHUVUKeHd4U2dSOWZRNElu'
    + 'dStyUHJOM0lteWswbEtQR0Y5U3pDUlJUaUpGUjcyc05xbE82bDBWOENXUkFQVFBKY2dxVgoxVThO'
    + 'SEs4YjNaaUlvR0orbXNOenBkeHJqNjJIM0E2K1krQXNOWTRTbVVUWEg5eWpnK251a2c9PQotLS0t'
    + 'LUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo=',
  pub: ''
    + 'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FR'
    + 'OEFNSUlCQ2dLQ0FRRUF4VEp1SzJhR0xuMWRYSktEaDRNdwpQTFVrbDNISTVwR25HNWFjNGwvMGlo'
    + 'bXE4Y3dDK0ZWUGdaTVM1OWF5a2lzQit6Qzd2dHZrSmsvYnYrQlNPWDdvCnhkSXN1TDNkS1FGcHVY'
    + 'WFZmcmRiOTV3WW40TSsvbmpFaFhNbGhWTUgvT0NpQWc5SktoVEtXTDZHUldaQUFoQTcKbEJSaGdT'
    + 'TkRUaVRDNTFDYmlLN3hBNnBONCt0UUh4b21KUFhyWlJrYkIya2xPZld3YnY5M1kzSjFLRkQraTBQ'
    + 'TQpRSEx3N3JoRXVteEM5MytISFVWWVZIN0gxVFBaSDFiZFVKSjAyZ1FleWxKc3NZQ0p5ZFpQek5U'
    + 'L3p1dHMvS0pXCmRSdjVseHdHOXU5dE1OTWdoSmJtQWFNa01HaStvN1BORXlQM3FIRnJZcFloczVw'
    + 'cUxITVJOQjc4UU05SWVOakwKRndJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==',
  der: ''
    + 'MIIDBjCCAe4CCQDI2qWdA3/VpDANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJBVTETMBEGA1UE'
    + 'CAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMB4XDTE0MDcx'
    + 'NjAxMzM1MVoXDTE1MDcxNjAxMzM1MVowRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3Rh'
    + 'dGUxITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQAD'
    + 'ggEPADCCAQoCggEBAMUybitmhi59XVySg4eDMDy1JJdxyOaRpxuWnOJf9IoZqvHMAvhVT4GTEufW'
    + 'spIrAfswu77b5CZP27/gUjl+6MXSLLi93SkBabl11X63W/ecGJ+DPv54xIVzJYVTB/zgogIPSSoU'
    + 'yli+hkVmQAIQO5QUYYEjQ04kwudQm4iu8QOqTePrUB8aJiT162UZGwdpJTn1sG7/d2NydShQ/otD'
    + 'zEBy8O64RLpsQvd/hx1FWFR+x9Uz2R9W3VCSdNoEHspSbLGAicnWT8zU/87rbPyiVnUb+ZccBvbv'
    + 'bTDTIISW5gGjJDBovqOzzRMj96hxa2KWIbOaaixzETQe/EDPSHjYyxcCAwEAATANBgkqhkiG9w0B'
    + 'AQUFAAOCAQEAL6AMMfC3TlRcmsIgHxjVD4XYtISlldnrn2X9zvFbJKCpNy8XQQosQxrhyfzPHQKj'
    + 'lS2L/KCGMnjx9QkYD2Hlp1MJ1uVv9888th/gcZOv3Or3hQyi5K1Sh5xCG+69lUOqUEGu9B4irsqo'
    + 'FomQVbQolSy+t4apdJi7kuEDwFDk4gZiVEfsuX+naN5a6pCnWnhX1Vf4fKwfkLobKKXm2zQVsjxl'
    + 'wBAqOEmJGDLoRMXH56qJnEZ/dqsczaJOHQSi9mFEHL0r5rsEDTT5AVxdnBfNnyGaCH7/zANEko+F'
    + 'GBj1JdJaJgFTXdbxDoyoPTPD+LJqSK5XYToo46y/T0u9CLveNA==',
  pem: ''
    + 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURCakNDQWU0Q0NRREkycVdkQTMvVnBEQU5C'
    + 'Z2txaGtpRzl3MEJBUVVGQURCRk1Rc3dDUVlEVlFRR0V3SkIKVlRFVE1CRUdBMVVFQ0F3S1UyOXRa'
    + 'UzFUZEdGMFpURWhNQjhHQTFVRUNnd1lTVzUwWlhKdVpYUWdWMmxrWjJsMApjeUJRZEhrZ1RIUmtN'
    + 'QjRYRFRFME1EY3hOakF4TXpNMU1Wb1hEVEUxTURjeE5qQXhNek0xTVZvd1JURUxNQWtHCkExVUVC'
    + 'aE1DUVZVeEV6QVJCZ05WQkFnTUNsTnZiV1V0VTNSaGRHVXhJVEFmQmdOVkJBb01HRWx1ZEdWeWJt'
    + 'VjAKSUZkcFpHZHBkSE1nVUhSNUlFeDBaRENDQVNJd0RRWUpLb1pJaHZjTkFRRUJCUUFEZ2dFUEFE'
    + 'Q0NBUW9DZ2dFQgpBTVV5Yml0bWhpNTlYVnlTZzRlRE1EeTFKSmR4eU9hUnB4dVduT0pmOUlvWnF2'
    + 'SE1BdmhWVDRHVEV1ZldzcElyCkFmc3d1NzdiNUNaUDI3L2dVamwrNk1YU0xMaTkzU2tCYWJsMTFY'
    + 'NjNXL2VjR0orRFB2NTR4SVZ6SllWVEIvemcKb2dJUFNTb1V5bGkraGtWbVFBSVFPNVFVWVlFalEw'
    + 'NGt3dWRRbTRpdThRT3FUZVByVUI4YUppVDE2MlVaR3dkcApKVG4xc0c3L2QyTnlkU2hRL290RHpF'
    + 'Qnk4TzY0Ukxwc1F2ZC9oeDFGV0ZSK3g5VXoyUjlXM1ZDU2ROb0VIc3BTCmJMR0FpY25XVDh6VS84'
    + 'N3JiUHlpVm5VYitaY2NCdmJ2YlREVElJU1c1Z0dqSkRCb3ZxT3p6Uk1qOTZoeGEyS1cKSWJPYWFp'
    + 'eHpFVFFlL0VEUFNIall5eGNDQXdFQUFUQU5CZ2txaGtpRzl3MEJBUVVGQUFPQ0FRRUFMNkFNTWZD'
    + 'MwpUbFJjbXNJZ0h4alZENFhZdElTbGxkbnJuMlg5enZGYkpLQ3BOeThYUVFvc1F4cmh5ZnpQSFFL'
    + 'amxTMkwvS0NHCk1uang5UWtZRDJIbHAxTUoxdVZ2OTg4OHRoL2djWk92M09yM2hReWk1SzFTaDV4'
    + 'Q0crNjlsVU9xVUVHdTlCNGkKcnNxb0ZvbVFWYlFvbFN5K3Q0YXBkSmk3a3VFRHdGRGs0Z1ppVkVm'
    + 'c3VYK25hTjVhNnBDblduaFgxVmY0Zkt3ZgprTG9iS0tYbTJ6UVZzanhsd0JBcU9FbUpHRExvUk1Y'
    + 'SDU2cUpuRVovZHFzY3phSk9IUVNpOW1GRUhMMHI1cnNFCkRUVDVBVnhkbkJmTm55R2FDSDcvekFO'
    + 'RWtvK0ZHQmoxSmRKYUpnRlRYZGJ4RG95b1BUUEQrTEpxU0s1WFlUb28KNDZ5L1QwdTlDTHZlTkE9'
    + 'PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==',
  sig1: new Buffer(0),
  sig2: new Buffer(0),
  sig3: new Buffer(0)
};

x509.priv = new Buffer(x509.priv, 'base64');
x509.pub = new Buffer(x509.pub, 'base64');
x509.der = new Buffer(x509.der, 'base64');
x509.pem = new Buffer(x509.pem, 'base64');

describe('PaymentProtocol', function() {

  this.timeout(15000);

  it('should be able to create class', function() {
    should.exist(PaymentProtocol);
  });

  describe('#Output', function() {

    it('should not fail', function() {
      var obj = {};
      var output = new PaymentProtocol.Output();
      output.$set('amount', 20);
    });

    it('should be able to set the amount of an output', function() {
      var output = new PaymentProtocol.Output();
      output.set('amount', 20);
      output.get('amount').toInt().should.equal(20);
    });

    it('should be able to make output using "makeOutput"', function() {
      var output = new PaymentProtocol().makeOutput();
      output.message.set('amount', 20);
      output.message.get('amount').toInt().should.equal(20);
    });

  });

  describe('#PaymentDetails', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentDetails();
    });

    it('should set the memo', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('memo', 'test memo');
      pd.get('memo').should.equal('test memo');
    });

    it('should serialize', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      pd.set('memo', 'test memo');
      var hex = pd.toHex();
      hex.length.should.be.greaterThan(0);
    });


    it('should serialize with required_fee_rate', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      pd.set('required_fee_rate', 110);
      pd.set('memo', 'test memo');
      var hex = pd.toHex();
      hex.length.should.be.greaterThan(0);
    });


  });

  describe('#PaymentRequest', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentRequest();
    });

    it('should serialize', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var pr = new PaymentProtocol.PaymentRequest();
      pr.set('serialized_payment_details', pdbuf);
      var prhex = pr.toHex();
      prhex.length.should.be.greaterThan(0);
    });

  });

  describe('#Payment', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PaymentProtocol.Payment();
    });

    it('should serialize', function() {
      var obj = {};
      var p = new PaymentProtocol.Payment();
      p.set('memo', 'this is a memo');
      p.get('memo').should.equal('this is a memo');
      var phex = p.toHex();
      phex.length.should.be.greaterThan(0);
    });

  });

  describe('#PaymentACK', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PaymentProtocol.PaymentACK();
    });

    it('should serialize', function() {
      var obj = {};
      var p = new PaymentProtocol.Payment();
      var pa = new PaymentProtocol.PaymentACK();
      pa.set('payment', p);
      pa.set('memo', 'this is a memo');
      pa.get('memo').should.equal('this is a memo');
      var pahex = pa.toHex();
      pahex.length.should.be.greaterThan(0);
    });

    it('makePaymentACK', function() {
      var payment = new PaymentProtocol.Payment();
      var ack = new PaymentProtocol().makePaymentACK();
      ack.set('payment', payment);
      ack.set('memo', 'this is a memo');
      ack.get('memo').should.equal('this is a memo');
      var valid = ack.isValidSize();
      valid.should.equal(true);
      var contentType = ack.getContentType();
      contentType.should.equal(PaymentProtocol.LEGACY_PAYMENT['BTC'].ACK_CONTENT_TYPE);
      var serialized = ack.serialize();
      serialized.length.should.be.greaterThan(0);
      var ack2 = new PaymentProtocol().makePaymentACK();
      ack2.deserialize(serialized, 'PaymentACK');
      var serialized2 = ack2.serialize();
      serialized.should.deep.equal(serialized2);
    });

    it('makePaymentACK BCH', function () {
      var payment = new PaymentProtocol.Payment();
      var ack = new PaymentProtocol().makePaymentACK(null, 'BCH');
      ack.set('payment', payment);
      ack.set('memo', 'this is a memo');
      ack.get('memo').should.equal('this is a memo');
      var valid = ack.isValidSize();
      valid.should.equal(true);
      var contentType = ack.getContentType();
      contentType.should.equal(PaymentProtocol.LEGACY_PAYMENT['BCH'].ACK_CONTENT_TYPE);
    });

  });

  describe('#X509Certificates', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PaymentProtocol.X509Certificates();
    });

    it('should serialize', function() {
      var obj = {};
      var x = new PaymentProtocol.X509Certificates();
      var fakecertificate = new Buffer([0, 0, 0, 0]);
      x.set('certificate', [fakecertificate]);
      var xhex = x.toHex();
      xhex.length.should.be.greaterThan(0);
    });

  });

  describe('#isValidSize', function() {

    it('should return true for validly sized payment', function() {
      var paypro = new PaymentProtocol();
      paypro.makePayment();
      paypro.set('memo', 'test memo');
      paypro.isValidSize().should.equal(true);
    });

  });

  describe('#getContentType', function() {

    it('should error without a known message type', function() {
      var paypro = new PaymentProtocol();
      paypro.messageType = 'unknown';
      expect(function(){
        paypro.getContentType();
      }).to.throw(Error);
    });

    it('should get a content type for payment', function() {
      var paypro = new PaymentProtocol();
      paypro.makePayment();
      paypro.set('memo', 'test memo');
      paypro.getContentType().should.equal('application/bitcoin-payment');
    });

  });

  describe('#set', function() {

    it('should set a field', function() {
      var obj = {};
      var paypro = new PaymentProtocol();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.get('memo').should.equal('test memo');
    });

  });

  describe('#get', function() {

    it('should get a field', function() {
      var obj = {};
      var paypro = new PaymentProtocol();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.get('memo').should.equal('test memo');
    });

  });

  describe('#setObj', function() {

    it('should set properties of paymentdetails', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      var paypro = new PaymentProtocol();
      paypro.messageType = "PaymentDetails";
      paypro.message = pd;
      paypro.setObj({
        time: 0
      });
      paypro.get('time').should.equal(0);
    });

  });

  describe('#serializeForSig', function() {

    it('should error when not a payment request', function() {
      var paypro = new PaymentProtocol();
      paypro.messageType = 'unknown';
      expect(function(){
        paypro.serializeForSig();
      }).to.throw(Error);
    });

    it('should serialize a PaymentRequest and not fail', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();

      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      var buf = paypro.serializeForSig();
      var valid = paypro.isValidSize();
      var contentType = paypro.getContentType();
      contentType.should.equal(PaymentProtocol.LEGACY_PAYMENT['BTC'].REQUEST_CONTENT_TYPE);
      valid.should.equal(true);
      buf.length.should.be.greaterThan(0);
    });

    it('should serialize a BCH PaymentRequest and not fail', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();

      var paypro = new PaymentProtocol('BCH');
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      var buf = paypro.serializeForSig();
      var valid = paypro.isValidSize();
      var contentType = paypro.getContentType();
      contentType.should.equal(PaymentProtocol.LEGACY_PAYMENT['BCH'].REQUEST_CONTENT_TYPE);
      valid.should.equal(true);
      buf.length.should.be.greaterThan(0);
    });

  });

  describe('#serialize', function() {

    it('should serialize', function() {
      var obj = {};
      var paypro = new PaymentProtocol();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.set('time', 0);
      var buf = paypro.serialize();
      buf.length.should.be.greaterThan(0);
      Buffer.isBuffer(buf).should.equal(true);
    });

  });

  describe('#deserialize', function() {

    it('should error without a message type', function() {
      var paypro = new PaymentProtocol();
      expect(function(){
        paypro.deserialize(new Buffer({size: 12}));
      }).to.throw(Error);
    });

    it('should deserialize a serialized message', function() {
      var obj = {};
      var paypro = new PaymentProtocol();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.set('time', 0);
      var buf = paypro.serialize();
      var paypro2 = new PaymentProtocol();
      paypro2.deserialize(buf, 'PaymentDetails');
      paypro2.get('memo').should.equal('test memo');
      paypro2.get('time').should.equal(0);
    });

  });

  describe('#sign', function() {

    it('should error when not a payment request', function() {
      var paypro = new PaymentProtocol();
      expect(function(){
        paypro.sign();
      }).to.throw(Error);
    });

    it('should not sign if the pki_type is "none"', function() {
      var paypro = new PaymentProtocol().makePaymentRequest();
      paypro.set('pki_type', 'none');
      var a = paypro.sign();
      var signature = a.get('signature');
      should.not.exist(signature);
    });

    it('should error if unkown pki_type', function() {
      var paypro = new PaymentProtocol().makePaymentRequest();
      paypro.set('pki_type', 'x508'); //typo
      expect(function(){
        paypro.sign();
      }).to.throw(Error);
    });

    it('should sign a payment request', function() {
      // SIN
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new PrivateKey();
      paypro.sign(key);
      var sig = paypro.get('signature');
      sig.length.should.be.greaterThan(0);

      // X509
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      var cr = new PaymentProtocol();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      paypro.sign(x509.priv);
      x509.sig1 = paypro.get('signature');
      x509.sig1.length.should.be.greaterThan(0);
    });

  });

  describe('#verify', function() {

    it('should error if not a payment request', function() {
      var paypro = new PaymentProtocol();
      expect(function(){
        paypro.verify();
      }).to.throw(Error);
    });

    it('should return true if pki_type is set to "none"', function() {
      var paypro = new PaymentProtocol().makePaymentRequest();
      paypro.set('pki_type', 'none');
      var valid = paypro.verify();
      valid.should.equal(true);
    });

    it('should error if unsupported pki_type', function() {
      var paypro = new PaymentProtocol().makePaymentRequest();
      paypro.set('pki_type', 'x508'); // typo
      expect(function(){
        paypro.verify();
      }).to.throw(Error);
    });

    it('should verify a signed payment request', function() {
      // SIN
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new PrivateKey();
      paypro.sign(key);
      var verify = paypro.verify();
      verify.should.equal(true);

      // X509
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');
      paypro.set('signature', x509.sig1); // sig buffer

      var cr = new PaymentProtocol();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.verify();
      verify.should.equal(true);

      var trust = paypro.verify(true);
      trust.selfSigned.should.equal(1);
      trust.isChain.should.equal(false);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(false);
      should.equal(null, trust.caName);
      trust.chainVerified.should.equal(false);
    });

  });

  describe('#sinSign', function() {

    it('should error if not sent an instance of PrivateKey', function() {
      var paypro = new PaymentProtocol();
      expect(function(){
        paypro.sinSign(Number(7)); // not a private key
      }).to.throw(TypeError);
    });

    it('should sign assuming pki_type is SIN', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new PrivateKey();
      var sig = paypro.sinSign(key);
      sig.length.should.be.greaterThan(0);
    });

  });

  describe('#sinVerify', function() {

    it('should verify assuming pki_type is SIN', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new PrivateKey();
      paypro.sign(key);
      var verify = paypro.sinVerify();
      verify.should.equal(true);
    });

  });

  describe('#x509+sha256Sign and #x509+sha256Verify ', function() {

    it('should sign and verify assuming pki_type is x509+sha256', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      var cr = new PaymentProtocol();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var sig = paypro.x509Sign(x509.priv);

      paypro.set('signature', sig);

      x509.sig2 = paypro.get('signature');
      x509.sig2.length.should.be.greaterThan(0);

      // Verify
      //
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      paypro.set('signature', x509.sig2); // sig buffer

      var cr = new PaymentProtocol();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.x509Verify();
      verify.should.equal(true);

      var trust = paypro.x509Verify(true);
      trust.selfSigned.should.equal(1);
      trust.isChain.should.equal(false);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(false);
      should.equal(null, trust.caName);
      trust.chainVerified.should.equal(false);
    });
  });

  describe('#x509+sha1Sign', function() {
    it('should sign assuming pki_type is x509+sha1', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha1');

      var cr = new PaymentProtocol();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var sigTrust = paypro.x509Sign(x509.priv, true);
      sigTrust.selfSigned.should.equal(1);
      sigTrust.isChain.should.equal(false);
      sigTrust.signature.length.should.be.greaterThan(0);
      sigTrust.caTrusted.should.equal(false);
      should.not.exist(sigTrust.caName);

      var sig = paypro.x509Sign(x509.priv);
      paypro.set('signature', sig);

      x509.sig3 = paypro.get('signature');
      x509.sig3.length.should.be.greaterThan(0);
    });
  });

  describe('#x509+sha1Verify', function() {
    it('should verify assuming pki_type is x509+sha1', function() {
      var pd = new PaymentProtocol.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PaymentProtocol();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha1');

      paypro.set('signature', x509.sig3); // sig buffer

      var cr = new PaymentProtocol();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.x509Verify();
      verify.should.equal(true);

      var trust = paypro.x509Verify(true);
      trust.selfSigned.should.equal(1);
      trust.isChain.should.equal(false);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(false);
      should.equal(null, trust.caName);
      trust.chainVerified.should.equal(false);
    });
  });

  describe('#x509+sha256Verify ', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(function() {
      sandbox.restore();
    });
    it('should verify a real PaymentRequest', function() {
      var data = PaymentProtocol.PaymentRequest.decode(SampleRequest.bitpay);
      var pr = new PaymentProtocol();
      pr = pr.makePaymentRequest(data);

      // PaymentRequest
      var ver = pr.get('payment_details_version');
      var pki_type = pr.get('pki_type');
      var pki_data = pr.get('pki_data');
      var details = pr.get('serialized_payment_details');
      var sig = pr.get('signature');

      pki_data = PaymentProtocol.X509Certificates.decode(pki_data);
      pki_data = pki_data.certificate;

      ver.should.equal(1);
      pki_type.should.equal('x509+sha256');
      pki_data.length.should.equal(4);
      sig.toString('hex').should.equal(''
        + '1566366ab78842a514c056ca7ecb76481262cac74cc4c4ccdc'
        + '82c4980bc3300de67836d61d3e06dc8c90798a7774c21c7ad4'
        + 'fe634b85faa8719d6402411bb720396ae03cbb4e14f06f7894'
        + 'a66b208b99f727fab35d32f4f2148294d24bea1b3f240c159d'
        + '0fd3ee4a32e5f926bf7c05eb7a3f75e01d9af81254cfbb6160'
        + '6467750ea7e0a1536728358e0898d06f57235e4096d2caf647'
        + 'ae58dff645be80c9b3555fa96c81efa07d421977d26214ad4f'
        + '1ff642a93d0925656aeab454fa0b60fcbb6c1bc570eb6e43e7'
        + '613392f37900748635ae381534bfaa558792bc46028b9efce3'
        + '91423a9c1201f76292614b30a14272e837f3813045b035f3d4'
        + '2f4f76f48acd');

      if (is_browser) {
        var type = 'SHA256';
        var pem = PaymentProtocol.prototype._DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var jsrsaSig = new KJUR.crypto.Signature({
          alg: type + 'withRSA',
          prov: 'cryptojs/jsrsa'
        });
        var signedCert = pki_data[0];
        var der = signedCert.toString('hex');
        // var pem = PaymentProtocol.DERtoPEM(der, 'CERTIFICATE');
        var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
        jsrsaSig.init(pem);
        jsrsaSig.updateHex(buf.toString('hex'));
        jsrsaSig.verify(sig.toString('hex')).should.equal(true);
      } else {
        var crypto = require('crypto');
        var type = 'SHA256';
        var pem = PaymentProtocol.DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var verifier = crypto.createVerify('RSA-' + type);
        verifier.update(buf);
        verifier.verify(pem, sig).should.equal(true);
      }

      // Stub time before cert expiration at Mar 27 2016
      var clock = sandbox.useFakeTimers(1459105693843);

      // Verify Signature
      var verified = pr.x509Verify();
      verified.should.equal(true);

      // Verify Signature with trust properties
      var trust = pr.x509Verify(true);
      trust.selfSigned.should.equal(0);
      trust.isChain.should.equal(true);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(true);
      trust.caName.should.equal('Go Daddy Class 2 CA');
      trust.chainVerified.should.equal(true);

      // Verify that expiration will fail verification (cert expires in april 2016)
      clock.restore();
      var verified2 = pr.x509Verify();
      verified2.should.equal(false);

      // PaymentDetails
      details = PaymentProtocol.PaymentDetails.decode(details);
      var pd = new PaymentProtocol();
      pd = pd.makePaymentDetails(details);
      var network = pd.get('network');
      var outputs = pd.get('outputs');
      var time = pd.get('time');
      var expires = pd.get('expires');
      var memo = pd.get('memo');
      var payment_url = pd.get('payment_url');
      var merchant_data = pd.get('merchant_data');

      network.should.equal('test');
      outputs.length.should.equal(1);
      outputs[0].amount.should.not.equal(undefined);
      outputs[0].script.should.not.equal(undefined);
      time.should.equal(1408645830);
      expires.should.equal(1408646730);
      memo.should.equal('Payment request for BitPay invoice CMWpuFsjgmQ2ZLiyGfcF1W');
      payment_url.should.equal('https://test.bitpay.com/i/CMWpuFsjgmQ2ZLiyGfcF1W');
      should.equal(null, merchant_data);
    });

    it('should verify a real PaymentRequest without Root Cert', function() {
      var data = PaymentProtocol.PaymentRequest.decode(SampleRequest.bitpay3);
      var pr = new PaymentProtocol();
      pr = pr.makePaymentRequest(data);

      // PaymentRequest
      var ver = pr.get('payment_details_version');
      var pki_type = pr.get('pki_type');
      var pki_data = pr.get('pki_data');
      var details = pr.get('serialized_payment_details');
      var sig = pr.get('signature');

      pki_data = PaymentProtocol.X509Certificates.decode(pki_data);
      pki_data = pki_data.certificate;

      ver.should.equal(1);
      pki_type.should.equal('x509+sha256');
      pki_data.length.should.equal(3);

      if (is_browser) {
        var type = 'SHA256';
        var pem = PaymentProtocol.prototype._DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var jsrsaSig = new KJUR.crypto.Signature({
          alg: type + 'withRSA',
          prov: 'cryptojs/jsrsa'
        });
        var signedCert = pki_data[0];
        var der = signedCert.toString('hex');
        // var pem = PaymentProtocol.DERtoPEM(der, 'CERTIFICATE');
        var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
        jsrsaSig.init(pem);
        jsrsaSig.updateHex(buf.toString('hex'));
        jsrsaSig.verify(sig.toString('hex')).should.equal(true);
      } else {
        var crypto = require('crypto');
        var type = 'SHA256';
        var pem = PaymentProtocol.DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var verifier = crypto.createVerify('RSA-' + type);
        verifier.update(buf);

        var verified = verifier.verify(pem, sig);
          
        verified.should.equal(true);
      }

      var trust = pr.x509Verify(true);

      // Verify Signature
      var verified = pr.x509Verify();
      verified.should.equal(true);

      // Verify Signature with trust properties
      var trust = pr.x509Verify(true);
      trust.selfSigned.should.equal(0);
      trust.isChain.should.equal(true);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(true);
      trust.caName.should.equal('Go Daddy Class 2 Certification Authority');
      trust.chainVerified.should.equal(true);

      // PaymentDetails
      details = PaymentProtocol.PaymentDetails.decode(details);
      var pd = new PaymentProtocol();
      pd = pd.makePaymentDetails(details);
      var network = pd.get('network');
      var outputs = pd.get('outputs');
      var time = pd.get('time');
      var expires = pd.get('expires');
      var memo = pd.get('memo');
      var payment_url = pd.get('payment_url');

      network.should.equal('main');
      outputs.length.should.equal(1);
      outputs[0].amount.should.not.equal(undefined);
      outputs[0].script.should.not.equal(undefined);
      time.should.equal(1508936331);
      expires.should.equal(1508937231);
      memo.should.equal('Payment request for BitPay invoice 4aKTwZemfhdmsBZATUkcaQ for merchant BitGive');
      payment_url.should.equal('https://bitpay.com/i/4aKTwZemfhdmsBZATUkcaQ');
      var merchant_data = pd.get('merchant_data');
      should.equal('{"invoiceId":"4aKTwZemfhdmsBZATUkcaQ","merchantId":"TxZ5RyChmZw2isKjJWGhBc"}', merchant_data.toString());
    });

    it.skip('should verify a real PaymentRequest without Root Cert (case 2: Coinbase)', function() {
      var data = PaymentProtocol.PaymentRequest.decode(SampleRequest.coinbase);
      var pr = new PaymentProtocol();
      pr = pr.makePaymentRequest(data);

      // PaymentRequest
      var ver = pr.get('payment_details_version');
      var pki_type = pr.get('pki_type');
      var pki_data = pr.get('pki_data');
      var details = pr.get('serialized_payment_details');
      var sig = pr.get('signature');

      pki_data = PaymentProtocol.X509Certificates.decode(pki_data);
      pki_data = pki_data.certificate;

      ver.should.equal(1);
      pki_type.should.equal('x509+sha256');

      pki_data.length.should.equal(2);


      if (is_browser) {
        var type = 'SHA256';
        var pem = PaymentProtocol.prototype._DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var jsrsaSig = new KJUR.crypto.Signature({
          alg: type + 'withRSA',
          prov: 'cryptojs/jsrsa'
        });
        var signedCert = pki_data[0];
        var der = signedCert.toString('hex');
        // var pem = PaymentProtocol.DERtoPEM(der, 'CERTIFICATE');
        var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
        jsrsaSig.init(pem);
        jsrsaSig.updateHex(buf.toString('hex'));
        jsrsaSig.verify(sig.toString('hex')).should.equal(true);
      } else {
        var crypto = require('crypto');
        var type = 'SHA256';
        var pem = PaymentProtocol.DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var verifier = crypto.createVerify('RSA-' + type);
        verifier.update(buf);
        verifier.verify(pem, sig).should.equal(true);
      }

      // Verify Signature
      var verified = pr.x509Verify();
      verified.should.equal(true);

      // Verify Signature with trust properties
      var trust = pr.x509Verify(true);
      trust.selfSigned.should.equal(0);
      trust.isChain.should.equal(true);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(true);
      trust.caName.should.equal('Go Daddy Class 2 Certification Authority');
      trust.chainVerified.should.equal(true);

      // PaymentDetails
      details = PaymentProtocol.PaymentDetails.decode(details);
      var pd = new PaymentProtocol();
      pd = pd.makePaymentDetails(details);
      var network = pd.get('network');
      var outputs = pd.get('outputs');
      var time = pd.get('time');
      var expires = pd.get('expires');
      var memo = pd.get('memo');
      var payment_url = pd.get('payment_url');

      network.should.equal('main');
      outputs.length.should.equal(1);
      outputs[0].amount.should.not.equal(undefined);
      outputs[0].script.should.not.equal(undefined);
      time.should.equal(1442409238);
      expires.should.equal(1442410138);
      memo.should.equal('Payment request for BitPay invoice PAQtNxX7KL8BtJBnfXyTaH for merchant BitGive Foundation');
      payment_url.should.equal('https://bitpay.com/i/PAQtNxX7KL8BtJBnfXyTaH');
      var merchant_data = pd.get('merchant_data');
      should.equal('{"invoiceId":"PAQtNxX7KL8BtJBnfXyTaH","merchantId":"TxZ5RyChmZw2isKjJWGhBc"}', merchant_data.toString());
    });


  });

  describe('#PEMtoDER', function() {
    it('should convert a PEM cert to DER', function() {
      var paypro = new PaymentProtocol();
      var der1 = paypro._PEMtoDERParam(x509.pem.toString(), 'CERTIFICATE').map(function(der) {
        return der.toString('hex');
      });
      der1 = der1[0];
      var der2 = x509.der.toString('hex');
      der1.should.equal(der2);
    });
  });

  describe('#DERtoPEM', function() {
    it('convert a DER cert to PEM', function() {
      var paypro = new PaymentProtocol();
      var pem1 = paypro._DERtoPEM(x509.der, 'CERTIFICATE');
      //var KJUR = require('jsrsasign');
      //var pem2 = KJUR.asn1.ASN1Util.getPEMStringFromHex(x509.der.toString('hex'), 'CERTIFICATE');
      var pem2 = x509.pem.toString();
      pem1 = pem1.replace(/\s+/g, '');
      pem2 = pem2.replace(/\s+/g, '');
      pem1.should.equal(pem2);
    });
  });


});
