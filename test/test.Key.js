var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var buffertools = require('buffertools');

var should = chai.should();
var assert = chai.assert;

var Key = bitcore.Key;
var Point = bitcore.Point;
var bignum = bitcore.Bignum;

var testdata = testdata || require('./testdata');

describe('Key (ECKey)', function() {
  it('should initialize the main object', function() {
    should.exist(Key);
  });
  it('should be able to create instance', function() {
    var k = new Key();
    should.exist(k);
  });
  it('should set change compressed to uncompressed', function() {
    var key = Key.generateSync();
    key.public.length.should.equal(33);
    key.compressed = false;
    key.public.length.should.equal(65);
  });
  it('should change uncompressed to compressed', function() {
    var key = Key.generateSync();
    key.compressed = false;
    var key2 = new Key();
    key2.public = key.public;
    key2.compressed = true;
    key2.public.length.should.equal(33);
  });
  it('should be able to generateSync instance', function() {
    var k = Key.generateSync();
    should.exist(k);
    (k instanceof Key).should.be.ok;
  });
  it('should retain some basic properties', function() {
    var k = Key.generateSync();
    should.exist(k.private);
    should.exist(k.public);
    should.exist(k.compressed);
  });
  it('should have a valid public key', function() {
    var k = Key.generateSync();
    k.compressed.should.be.ok;
    k.public.length.should.equal(33);
    k.public[0].should.be.above(1);
    k.public[0].should.be.below(4);
  });
  it('should have a valid private key', function() {
    var k = Key.generateSync();
    k.private.length.should.be.below(33);
    k.private.length.should.be.above(30);
  });

  it('should be able to regenerate from a private key', function() {
    var k = Key.generateSync();
    var pkshex = 'b7dafe35d7d1aab78b53982c8ba554584518f86d50af565c98e053613c8f15e0';
    var pubhex = '02211c9570d24ba84a3ee31c8a08e93a6756b3f3beac76a4ab8d9748ca78203389';
    k.private = buffertools.fromHex(new Buffer(pkshex));
    k.regenerateSync();
    k.compressed.should.be.ok;
    buffertools.toHex(k.private).should.equal(pkshex);
    buffertools.toHex(k.public).should.equal(pubhex);
  });
  it('should generate a hardcoded public key example', function() {
    var k = new Key();
    k.private = new Buffer('876156ccb16bb1760ddda6ad3e561c026fc0d679ad7860b71dd11c30e42f6589','hex');
    k.regenerateSync();

    k.compressed.should.equal(true);
    var pHex = bitcore.buffertools.toHex(k.public);
    pHex.should.equal('0394615227fd5ff4d4dfac88cf148e43d35a7a059788dd2479f60cea807b09d0c2');
  });

  it('should not fail checking good signSync status', function() {
    var k = Key.generateSync();
    var b = new Buffer(32);
    k.signSync.bind(k,b).should.not.Throw(Error);
  });
  it('should fail checking bad signSync params', function() {
    var k = Key.generateSync();
    k.signSync.bind(k,'1').should.Throw(Error);
    k.signSync.bind(k,new Buffer(10)).should.Throw(Error);
    k.signSync.bind(k,new Buffer(32)).should.not.Throw(Error);
  });

  var a_hash = buffertools.fromHex(new Buffer('1122334455667788990011223344556677889900112233445566778899001122'));

  it('should create a signature without failling', function() {
    var k = Key.generateSync();
    var pkshex = 'b7dafe35d7d1aab78b53982c8ba554584518f86d50af565c98e053613c8f15e0';
    k.private = new Buffer(pkshex, 'hex');
    k.regenerateSync();
    k.compressed.should.be.ok;
    buffertools.toHex(k.private).should.equal(pkshex);
    k.signSync.bind(k,a_hash).should.not.Throw(Error);
  });
  it('roundtrip for signature/verify', function() {
    var k = Key.generateSync();
    var pub = k.public;

    // sign 
    var sig = k.signSync(a_hash);

    // checks sig. priv unknown.
    var k2 = new Key();
    k2.public = pub;
    var ret= k2.verifySignatureSync(a_hash, sig);
    ret.should.equal(true);
  });

  it('should verify a hardcoded example', function() {
    var k = new Key();
    k.private = new Buffer('876156ccb16bb1760ddda6ad3e561c026fc0d679ad7860b71dd11c30e42f6589','hex');
    k.regenerateSync();
    var pHex = bitcore.buffertools.toHex(k.public);
    pHex.should.equal('0394615227fd5ff4d4dfac88cf148e43d35a7a059788dd2479f60cea807b09d0c2');
    var a_hash = new Buffer('ce42c5c7f405461c38ea849130f51e48531ab3188390a21a15aeaa1faedbf0b2','hex');
    var sig= new Buffer('304602210099f689f846a1590cf57f9cede2fe841d8552f114bc9e5f5603a333b00e69d3fa022100e83604ddd5f1ce6f5add3ac8da7dbf17f3ffe5b47205f3899caeaa54abdbcf07','hex');

    var ret= k.verifySignatureSync(a_hash, sig);
    ret.should.equal(true);

    var sig2= new Buffer('304602210099f689f846a1590cf57f9cede2fe841d8552f114bc9e5f5603a333b00e69d3fa022100e83604ddd5f1ce6f5add3ac8da7dbf17f3ffe5b47205f3899caeaa54abdbcf08', 'hex');
    var ret= k.verifySignatureSync(a_hash, sig2);
    ret.should.equal(false);
  });

  describe('#parseDERsig', function() {
    it('should parse this signature generated in node', function() {
      var sighex = '30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72';
      var sig = new Buffer(sighex, 'hex');
      var parsed = Key.parseDERsig(sig);
      parsed.header.should.equal(0x30)
      parsed.length.should.equal(69)
      parsed.rlength.should.equal(33);
      parsed.rneg.should.equal(true);
      parsed.rbuf.toString('hex').should.equal('008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa');
      parsed.r.toString().should.equal('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      parsed.slength.should.equal(32);
      parsed.sneg.should.equal(false);
      parsed.sbuf.toString('hex').should.equal('0993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72');
      parsed.s.toString().should.equal('4331694221846364448463828256391194279133231453999942381442030409253074198130');
    });

    it('should parse this 69 byte signature', function() {
      var sighex = '3043021f59e4705959cc78acbfcf8bd0114e9cc1b389a4287fb33152b73a38c319b50302202f7428a27284c757e409bf41506183e9e49dfb54d5063796dfa0d403a4deccfa';
      var sig = new Buffer(sighex, 'hex');
      var parsed = Key.parseDERsig(sig);
      parsed.header.should.equal(0x30)
      parsed.length.should.equal(67)
      parsed.rlength.should.equal(31);
      parsed.rneg.should.equal(false);
      parsed.rbuf.toString('hex').should.equal('59e4705959cc78acbfcf8bd0114e9cc1b389a4287fb33152b73a38c319b503');
      parsed.r.toString().should.equal('158826015856106182499128681792325160381907915189052224498209222621383996675');
      parsed.slength.should.equal(32);
      parsed.sneg.should.equal(false);
      parsed.sbuf.toString('hex').should.equal('2f7428a27284c757e409bf41506183e9e49dfb54d5063796dfa0d403a4deccfa');
      parsed.s.toString().should.equal('21463938592353267769710297084836796652964571266930856168996063301532842380538');
    });

    it('should parse this 68 byte signature', function() {
      var sighex = '3042021e17cfe77536c3fb0526bd1a72d7a8e0973f463add210be14063c8a9c37632022061bfa677f825ded82ba0863fb0c46ca1388dd3e647f6a93c038168b59d131a51';
      var sig = new Buffer(sighex, 'hex');
      var parsed = Key.parseDERsig(sig);
      parsed.header.should.equal(0x30)
      parsed.length.should.equal(66)
      parsed.rlength.should.equal(30);
      parsed.rneg.should.equal(false);
      parsed.rbuf.toString('hex').should.equal('17cfe77536c3fb0526bd1a72d7a8e0973f463add210be14063c8a9c37632');
      parsed.r.toString().should.equal('164345250294671732127776123343329699648286106708464198588053542748255794');
      parsed.slength.should.equal(32);
      parsed.sneg.should.equal(false);
      parsed.sbuf.toString('hex').should.equal('61bfa677f825ded82ba0863fb0c46ca1388dd3e647f6a93c038168b59d131a51');
      parsed.s.toString().should.equal('44212963026209759051804639008236126356702363229859210154760104982946304432721');
    });
  });

  describe('#rs2DER', function() {
    it('should convert these known r and s values into a known signature', function() {
      var r = new bignum('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      var s = new bignum('4331694221846364448463828256391194279133231453999942381442030409253074198130');
      var der = Key.rs2DER(r, s);
      der.toString('hex').should.equal('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72');
    });
  });

  describe('generateSync', function() {
    it('should not generate the same key twice in a row', function() {
      var key1 = Key.generateSync();
      var key2 = Key.generateSync();
      key1.private.toString('hex').should.not.equal(key2.private.toString('hex'));
    });
  });

  describe('signSync', function() {
    it('should not generate the same signature twice in a row', function() {
      var hash = coinUtil.sha256('my data');
      var key = new Key();
      key.private = coinUtil.sha256('a fake private key');
      key.regenerateSync();
      var sig1 = key.signSync(hash);
      var sig2 = key.signSync(hash);
      sig1.toString('hex').should.not.equal(sig2.toString('hex'));
    });

    it('should sign 10 times and have a different signature each time', function() {
      var key = new Key();
      key.private = coinUtil.sha256('my fake private key');
      key.regenerateSync();
      var data = coinUtil.sha256('the data i am signing');
      var sigs = [];
      for (var i = 0; i < 10; i++)
        sigs[i] = key.signSync(data);
      for (var i = 0; i < 10; i++)
        for (var j = i + 1; j < 10; j++)
          sigs[i].toString('hex').should.not.equal(sigs[j].toString('hex'));
    });
  });

  describe('verifySync', function() {
    var hash = bitcore.util.sha256('test data');
    var key = new bitcore.Key();
    key.private = bitcore.util.sha256('my fake private key');
    key.regenerateSync();

    it('should verify a signature created right here', function() {
      var sig = key.signSync(hash);
      key.verifySignatureSync(hash, sig).should.equal(true);
    });

    it('should fail on an invalid signature', function() {
      var sig = key.signSync(hash);
      sig[15] = !sig[15];
      key.verifySignatureSync(hash, sig).should.equal(false);
    });

    it('should verify this example generated in the browser', function() {
      var sig = new Buffer('304402200e02016b816e1b229559b6db97abc528438c64056a412eee2b7c41887ddf17010220ad9f1cd56fd382650286f51a842bba0a7664da164093db956b51f623b0d8e64f', 'hex');
      key.verifySignatureSync(hash, sig).should.equal(true);
    });

    it('should verify this example generated in node', function() {
      var sig = new Buffer('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72', 'hex')
      key.verifySignatureSync(hash, sig).should.equal(true);
    });
  });

  describe('bug in linux', function() {
    it('should assign private key starting with 0 properly', function(){
      var key = new Key();
      var hex = '000000000000000019fd3ee484410966c7a1f8098069d1f2a3846b409fbb0e76';
      var pk = new Buffer(hex, 'hex');
      pk.toString('hex').should.equal(hex);
      key.private = pk;
      key.private.toString('hex').should.equal(hex);

    });
  });

  describe('secp256k1 test vectors', function() {
    //test vectors from http://crypto.stackexchange.com/questions/784/are-there-any-secp256k1-ecdsa-test-examples-available
    testdata.dataSecp256k1.nTimesG.forEach(function(val) {
      it('should multiply n by G and get p from test data', function() {
        var key = new Key();
        key.private = new Buffer(val.n, 'hex');
        key.regenerateSync();
        key.compressed = false;
        key.public.slice(1, 33).toString('hex').toUpperCase().should.equal(val.px);
        key.public.slice(33, 65).toString('hex').toUpperCase().should.equal(val.py);
      });
    });
  });

});
