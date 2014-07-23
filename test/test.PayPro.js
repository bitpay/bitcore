'use strict';

var chai = chai || require('chai');
var should = chai.should();
var expect = chai.expect;
var bitcore = bitcore || require('../bitcore');

var PayPro = bitcore.PayPro;
var Key = bitcore.Key;

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
      // SIN
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

      // X509
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      paypro.sign(x509.priv);
      x509.sig1 = paypro.get('signature');
      x509.sig1.length.should.be.greaterThan(0);
    });

  });

  describe('#verify', function() {

    it('should verify a signed payment request', function() {
      // SIN
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

      // X509
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');
      paypro.set('signature', x509.sig1); // sig buffer

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

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

  describe('#x509+sha256Sign', function() {
    it('should sign assuming pki_type is x509+sha256', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var sig = paypro.x509Sign(x509.priv);
      paypro.set('signature', sig);

      x509.sig2 = paypro.get('signature');
      x509.sig2.length.should.be.greaterThan(0);
    });
  });

  describe('#x509+sha256Verify', function() {
    it('should verify assuming pki_type is x509+sha256', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      paypro.set('signature', x509.sig2); // sig buffer

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.x509Verify();
      verify.should.equal(true);
    });
  });

  describe('#x509+sha1Sign', function() {
    it('should sign assuming pki_type is x509+sha1', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha1');

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var sig = paypro.x509Sign(x509.priv);
      paypro.set('signature', sig);

      x509.sig3 = paypro.get('signature');
      x509.sig3.length.should.be.greaterThan(0);
    });
  });

  describe('#x509+sha1Verify', function() {
    it('should verify assuming pki_type is x509+sha1', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha1');

      paypro.set('signature', x509.sig3); // sig buffer

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.x509Verify();
      verify.should.equal(true);
    });
  });

  describe('#PEMtoDER', function() {
    it('should convert a PEM cert to DER', function() {
      var paypro = new PayPro();
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
      var paypro = new PayPro();
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
