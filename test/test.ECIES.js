'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var should = chai.should();
var assert = chai.assert;
var ECIES = bitcore.ECIES;
var Point = bitcore.Point;

describe('ECIES', function() {

  describe('#getRandomSeed', function() {

    it('should set r and R', function() {
      var ecies = new ECIES();
      ecies.getRandomSeed();
      ecies.r.length.should.equal(32);
      ecies.R.toUncompressedPubKey().length.should.equal(65);
    });

    it('should not set the same r twice in a row', function() {
      var ecies = new ECIES();
      ecies.getRandomSeed();
      var ecies2 = new ECIES();
      ecies2.getRandomSeed();
      ecies.r.toString('hex').should.not.equal(ecies2.r.toString('hex'));
    });

  });

  describe('#encryptObj', function() {
    
    it('should not fail', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message');
      var ecies = ECIES.encryptObj(key.public, message);

      should.exist(ecies.R);
      should.exist(ecies.c);
      should.exist(ecies.d);
    });

  });

  describe('#encrypt', function() {
    
    it('should not fail', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message');
      var encrypted = ECIES.encrypt(key.public, message);

      should.exist(encrypted);
    });

  });

  describe('#decrypt', function() {

    it('should not fail', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message');
      var encrypted = ECIES.encrypt(key.public, message);
      
      var decrypted = ECIES.decrypt(key.private, encrypted);

      decrypted.toString().should.equal('this is my message');
    });

    it('should encrypt and decrypt 0x80 correctly, the first bad byte', function() {
      var privhex = 'e0224327f5e4a9daea6c7b996cb013775f90821d15d7d0d25db517c7cd0c1a8e';
      var key = new bitcore.Key();
      key.private = new Buffer(privhex, 'hex');
      key.regenerateSync();

      var data = new Buffer([0x80]);
      var encrypted = bitcore.ECIES.encrypt(key.public, data);
      var decrypted = bitcore.ECIES.decrypt(key.private, encrypted);
      decrypted.toString('hex').should.equal('80');
      decrypted.toString('hex').should.not.equal('c280');
    });

    it('should encrypt and decrypt this known problematic encrypted message', function() {
      var privhex = 'e0224327f5e4a9daea6c7b996cb013775f90821d15d7d0d25db517c7cd0c1a8e';
      var key = new bitcore.Key();
      key.private = new Buffer(privhex, 'hex');
      key.regenerateSync();

      var data = new Buffer('010053bdae9b000000017b2274797065223a2268656c6c6f222c22636f70617965724964223a22303237323735366234366561386564313763376166613934303861306161333535616266326432623263353134373637343766353135326332623535653163656230227d', 'hex');
      var data = new Buffer('53bdae00', 'hex');

      var encrypted = bitcore.ECIES.encrypt(key.public, data);
      var decrypted = bitcore.ECIES.decrypt(key.private, encrypted);
      decrypted.toString('hex').should.not.equal('53c2bdc2ae00');
      decrypted.toString('hex').should.equal('53bdae00');

    });

    it('should encrypt and decrypt this known problematic encrypted message', function() {
      var privhex = 'e0224327f5e4a9daea6c7b996cb013775f90821d15d7d0d25db517c7cd0c1a8e';
      var key = new bitcore.Key();
      key.private = new Buffer(privhex, 'hex');
      key.regenerateSync();

      var data = new Buffer('010053bdae9b000000017b2274797065223a2268656c6c6f222c22636f70617965724964223a22303237323735366234366561386564313763376166613934303861306161333535616266326432623263353134373637343766353135326332623535653163656230227d', 'hex');
      var encrypted = bitcore.ECIES.encrypt(key.public, data);
      var decrypted = bitcore.ECIES.decrypt(key.private, encrypted);
      decrypted.toString('hex').should.equal('010053bdae9b000000017b2274797065223a2268656c6c6f222c22636f70617965724964223a22303237323735366234366561386564313763376166613934303861306161333535616266326432623263353134373637343766353135326332623535653163656230227d');

    });

    it('should decrypt this known problematic encrypted message', function() {
      var privhex = 'e0224327f5e4a9daea6c7b996cb013775f90821d15d7d0d25db517c7cd0c1a8e';
      var key = new bitcore.Key();
      key.private = new Buffer(privhex, 'hex');
      key.regenerateSync();

      var encryptedhex = '02f773c550bf228327f773b1dc63802055ba7333ee4ea86323e1a77365f14fede041dbe628dc636c5eebb572578e79184a96eee82db57b456328ca080a9e8b0b856474119f65b942b088ce09dcfb8536632d57343d533e9b55c8f17cc52466a6dfada1848923782e99e8f2210cfd6a04510ea0a482f38e43a88b018b6e9cc27511df873f7aea04fd342a42f651481f42f91a7a672ef9d56080d072417ca6cb1a2771b6838f08ab49470d84fa67f85886382b503ab86fefd02195e49c0f8516884a3adc62bf176c5ff1665bafe1c9af59f6857531e86c2a650bebdbc60970f6b1ce';
      var encrypted = new Buffer(encryptedhex, 'hex');

      var decrypted = bitcore.ECIES.decrypt(key.private, encrypted);
      decrypted.slice(10).toString().should.equal('{"type":"hello","copayerId":"024c0ec590ba86bbaf7beb9823c6610d02eacb9c3345bc678c09cc266590681af0"}');

    });

    it('should not fail for long messages', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message ');

      var encrypted = ECIES.encrypt(key.public, message);
      
      var decrypted = ECIES.decrypt(key.private, encrypted);

      decrypted.toString().should.equal(message.toString());
    });

    it('should encrypt this long message the same way every time when r and iv are specified', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var message = new Buffer('this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message this is my message ');

      var encrypted = ECIES.encrypt(key.public, message, key.private, key.private.slice(0, 16));

      encrypted.toString('hex').should.equal('025f81956d5826bad7d30daed2b5c8c98e72046c1ec8323da336445476183fb7ca9f86d081884c7d659a2feaa0c55ad015205e30d1ecdcfd17e437e91a7fef7859770462f56d111f979aa2d728ef9ccf206dd2f2db2e1f38ae4b2ab56cbee1401c4e9d63f0a44195224b5ae6b22e624ab0f5c6591de07c050751dce6e4137e2f1647990da4877e700f7669bb8644bcaac1cd794a00a4de248af4f86e94bc1aab8b873f5602a86c4b55546565948634f54ce22fd16c5eba57e412dfd518706152f457df1460f958f86a5952f48e64473b8abff30d25914f6240bd033f89e6b1c5365c12c4dd6d9bc8648b64c68f90de3f2fa70c1437a6b803213424f85c382e9d5c9d1027f46eb0d831d94a8986ed682d8265d73d40e3ca497536342a4144df9cb798c94a6f6cebaab8c12e3549e81fcf96dec1430f756c03d04b4727e12b46dc03d7ea64c21c8afb9a99d2a10ac4315e89a6e3a85994b359fd9fba8005e2c8a8b1bbb4b95f44a4a27332ea6b55de2599f1ead09cd57578b99e53344538261e7a01d8ed9f0d015f77ae9dea00a99f1d90654c5def58ecace0e18a50c29796716c16e52ba5a94200342d398318c2f3def1a86b75c0e7c44f629b83e7f3e907a90fceb7ac7f73e10a3baebf0defa08539f28f107e2b18e0419443188941fa4c354812fd07e38c35f35423c509c3fe728822618585a7cc69898f6f76f0426db547c06596472f13d5334b9c1382adca9350957f2120d038945b154b76e5e63283e501c5c7a0896ad98f5f844eb1244477651fccba214dff2c1b3849c0dc5d6141667f071a16715ae05e35cece182296f0d030392718199025aa01aec1b70ab218ffb2fe019d236456f0428e642d84529ab690df43945c112e12f3b4455a1eb7b9648246882eff3e2be69aeb8b2d4d826c8e7d1f96d8c8f0119e69da5a5ba92be2b3079477fb4046ffaa0528ff3c10414583b196fd893f504f6caaa4966ffc40b8ec92891bd60b6b094ae0fdbcd85e2ae88b6c1be083f600a3c996ad5c3f344154791488b0fa3cb42bb8234ff73edafc35b6f0b661aea1afa7c83dc4616e547c72ec3a81138a237f5c70f7a33881b1b298b425f6ed6b172eb2b947c294887d37decf9a5712f6df8c9b48cd6366a9f1f56baf71f26c76ac873a73e361664a7fc54be48840276e4a9190ce5431abbd31b221540928295f173958207b00b7b20d60dfca7abf68b11ff2f5661eb70056f70852cae812373e1fd4a3460e2df8117e814c89ba22e4ba91f65f9e1b1bb21cae43004183633e222b558aaa285cf46489b4d9b0af8c91bc77e70eb985c245651b6b6ff6fa098d362bb338f56bbd1dc37791ac058ff47809492cf7b6b2397141c4ce6ca0012416b0970e3d3dcd7273da3866271da086645fb42ade49334a2e160e801a8f3fbea7c9c040912a4f3b1d8e1e12c02adeacb94fcbecd015a1dc68dfb714a57466ae179007eb23f7215e6bd2918e3ee942c5c53808ec4c142b1e546608019e35835a8d32b03f4e7453ff5caf4b00c6741c72b0868e6012b3a05dff9ed8b3f0c1767b634e6229cf8c831036275920c34d3e5fbf123d1e743a17545f756ac7ceffc52b7e0fb85db566a4893086c96fe2dfbe87b50a2f61e8a0a52511a857d50a11a1a60b8ea7e8c1688e41c8fff7cdbe5ecab897b9ad043d4c460c9d181da9b0d5fa5fad6e47adbae858e3c5152c3355cc662490355629afd235d46677ab7cf76c998c1dece64b9c614327d9e0a79420b80bc6e98fe001f0457f98b0be0c95aa7272e775319489853bd3f7c526c64bf7f8b57a6d895c5db97096051654933cb8719a1c573ac023636fe4999a3b241cb99346d161e9d487142b10e8a881fcbfb014d04d661415b654655c587848a7b445e5120d8259dcf69238b6c21c27af40222fb7b3bf9ad7420d9e982ad0c4e5010830f00bf2173d4061bc91c9d36e116798e127041c96faa672bf699931fd5f4e6358b6653d3502c03fc3f6f31c5082b8bfd05edcf138f578b7cc1adf139369f7e1a7fe7902fb097d292bc5c67f70c2499878e85ffe59fbfa7ce4a566ea6e9d3d7ae1ff2c4d11078d5484df92fce815487243459a9214d8a2dea4e2044addf21888a88bc3ec9d6d25092a64a4ed830eed0b53d14f9ddce6e0973162c84b0b7b1a96dd3b89e3f5a46198763b28570d020d6cb7bb48ed8c60e13b2f3771e8446d6311b93ef8');
      
    });

  });

  describe('#symmetricEncrypt', function() {
    
    it('should not fail', function() {
      var data = new Buffer([1, 2, 3, 4, 5]);
      var key = bitcore.util.sha256('test');
      var iv = bitcore.util.sha256('test').slice(0, 16);
      var encrypted = ECIES.symmetricEncrypt(key, iv, data);
      encrypted.length.should.equal(16 + 16);

    });

  });

  describe('#symmetricDecrypt', function() {

    it('should decrypt that which was encrypted', function() {
      var data = new Buffer([1, 2, 3, 4, 5]);
      var key = bitcore.util.sha256('test');
      var iv = bitcore.util.sha256('test').slice(0, 16);
      var encrypted = ECIES.symmetricEncrypt(key, iv, data);
      var decrypted = ECIES.symmetricDecrypt(key, encrypted);
      decrypted[0].should.equal(1);
      decrypted[4].should.equal(5);
    });

  });

  describe('#getSfromPubkey', function() {
    
    it('should find S correctly', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();
      var ecies = new ECIES();
      ecies.r = bitcore.util.sha256('test test');
      ecies.KB = key.public;
      var S = ecies.getSfromPubkey();
      S.toString('hex').should.equal('9de4c42c4190fa987d84ce735a0370f7bb42f8646cec6274c5420f5af8fbfdbc');
    });

  });

  describe('#getSfromPrivkey', function() {

    it('should find S the same as getSfromPubkey', function() {
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test');
      key.regenerateSync();

      var r = bitcore.util.sha256('test test');
      var key2 = new bitcore.Key();
      key2.private = r;
      key2.regenerateSync();
      key2.compressed = false;
      var R = Point.fromUncompressedPubKey(key2.public);

      var ecies = new ECIES();
      ecies.r = r;
      ecies.KB = key.public;
      var S = ecies.getSfromPubkey();

      var ecies2 = new ECIES();
      ecies2.R = R;
      ecies2.kB = key.private;
      var S2 = ecies2.getSfromPrivkey();
      
      S.toString('hex').should.equal(S2.toString('hex'));
    });
    
  });

  describe('#kdf', function() {
    
    it('should be sha512', function() {
      var data = new Buffer([0, 1, 2, 3, 4, 5, 6]);
      ECIES.kdf(data).toString('hex').should.equal(bitcore.util.sha512(data).toString('hex'));
    });
  });

});
