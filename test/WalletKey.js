var assert = require('assert');
var WalletKey = require('../WalletKey').class();

describe('WalletKey', function(){
  describe('#regenerate', function(){
    it('accurately update the public key to correspond to the private key', function(){
      var wkey=new WalletKey({'network':'testnet'});
      wkey.generate();
      var privstr1=wkey.privKey.private.toString('hex');
      var pubstr1=wkey.privKey.public.toString('hex');
      wkey.generate();
      var privstr2=wkey.privKey.private.toString('hex');
      var pubstr2=wkey.privKey.public.toString('hex');
      wkey.privKey.private=new Buffer(privstr1, 'hex');
      wkey.regenerate();
      var privstr3=wkey.privKey.private.toString('hex');
      var pubstr3=wkey.privKey.public.toString('hex');
      assert.equal(privstr1,privstr3);
      assert.equal(pubstr1,pubstr3);
      assert.notEqual(privstr1,privstr2);
      assert.notEqual(pubstr1,pubstr2);
    });
  });
});
