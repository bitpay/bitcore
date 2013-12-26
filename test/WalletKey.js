var assert = require('assert');
var WalletKey = require('../WalletKey').class();
var networks = require('../networks');
var base58check=require('base58-native').base58Check;
var util=require('../util/util');

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

  describe('#storeObj', function(){
    it('should produce this testnet address correctly, whether the pubkey is compressed or not', function(){
      var privstr='bed1a954ace44c5199b0714578c0e90fb178b8a38925844a212c16164fd923d1';
      var privbuf=new Buffer(privstr,'hex');
      var privprefixbuf=new Buffer([239]);
      var privprefixstr=privprefixbuf.toString('hex');
      var privb58=base58check.encode(new Buffer(privprefixstr+privstr,'hex'));
      assert.equal(privb58,'932xNtWajvT84U5j9Nk1ewkFpMteKrebrVmwNNbjXhRQBicHh9q');
      var wkey=new WalletKey({'network':networks.testnet});
      wkey.generate();
      wkey.privKey.private=privbuf;
      wkey.regenerate();
      assert.equal(wkey.privKey.public.toString('hex'),'03e6ce14778396d4ff6153143211fa1879c8af9847755d94cceec87b9f18f632ba');
      wkey.privKey.compressed=false;
      assert.equal(wkey.privKey.public.toString('hex'),'04e6ce14778396d4ff6153143211fa1879c8af9847755d94cceec87b9f18f632baf153138c5c31ab32e2dbfd83bfb3c56d6f006e455947d00e4bbb69c3a5b0bedd');
      var pubprefixbuf=new Buffer([111]);
      var hash=util.sha256ripe160(wkey.privKey.public);
      var addr=base58check.encode(new Buffer(pubprefixbuf.toString('hex')+hash.toString('hex'),'hex'));
      var hash_of_compressed_pubkey='mjqvMx8Nf4VPn9xBc6WSEfpZagGkg9U1Yy';
      var hash_of_uncompressed_pubkey='mgJpLxNE4uztCKZ4tpjJtjNtqDPMLm6Td8';
      assert.notEqual(addr,hash_of_compressed_pubkey);
      assert.equal(addr,hash_of_uncompressed_pubkey);

      //whether the pubkey is compressed or not, storeObj should always return the same address
      wkey.privKey.compressed=true;
      var storeObj=wkey.storeObj();
      assert.notEqual(storeObj.addr,hash_of_compressed_pubkey);
      assert.equal(storeObj.addr,hash_of_uncompressed_pubkey);
      wkey.privKey.compressed=false;
      var storeObj=wkey.storeObj();
      assert.notEqual(storeObj.addr,hash_of_compressed_pubkey);
      assert.equal(storeObj.addr,hash_of_uncompressed_pubkey);
    });
  });
});
