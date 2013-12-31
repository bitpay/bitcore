var assert = require('assert');
var PrivateKey = require('../PrivateKey').class();
var networks = require('../networks');

describe('PrivateKey', function(){
  describe('#as', function(){
    it('should convert hex testnet private key with compressed public key to base58check format', function() {
      var hex='b9f4892c9e8282028fea1d2667c4dc5213564d41fc5783896a0d843fc15089f3';
      var buf=new Buffer(hex,'hex');
      var result='cTpB4YiyKiBcPxnefsDpbnDxFDffjqJob8wGCEDXxgQ7zQoMXJdH';
      var privkey=new PrivateKey(networks.testnet.keySecret,buf,true);
      assert.equal(privkey.as('base58'),result);
    });
  });
});
