var BN = require('../lib/bn');
var should = require('chai').should();
var Signature = require('../lib/signature');

describe('Signature', function() {

  it('should make a blank signature', function() {
    var sig = new Signature();
    should.exist(sig);
  });

  it('should work with conveniently setting r, s', function() {
    var r = BN();
    var s = BN();
    var sig = new Signature(r, s);
    should.exist(sig);
    sig.r.toString().should.equal(r.toString());
    sig.s.toString().should.equal(s.toString());
  });

  describe('#set', function() {
    
    it('should set compressed', function() {
      should.exist(Signature().set({compressed: true}));
    });

  });

  describe('#fromCompact', function() {
    
    it('should create a signature from a compressed signature', function() {
      var blank = new Buffer(32);
      blank.fill(0);
      var compressed = Buffer.concat([
        new Buffer([0 + 27 + 4]),
        blank,
        blank
        ]);
      var sig = new Signature();
      sig.fromCompact(compressed);
      sig.r.cmp(0).should.equal(0);
      sig.s.cmp(0).should.equal(0);
    });

  });

  describe('#fromDER', function() {
    
    var buf = new Buffer('3044022075fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e62770220729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2', 'hex');

    it('should parse this DER format signature', function() {
      var sig = new Signature();
      sig.fromDER(buf);
      sig.r.toBuffer({size: 32}).toString('hex').should.equal('75fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e6277');
      sig.s.toBuffer({size: 32}).toString('hex').should.equal('729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2');
    });

  });

  describe('#fromString', function() {
    
    var buf = new Buffer('3044022075fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e62770220729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2', 'hex');

    it('should parse this DER format signature in hex', function() {
      var sig = new Signature();
      sig.fromString(buf.toString('hex'));
      sig.r.toBuffer({size: 32}).toString('hex').should.equal('75fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e6277');
      sig.s.toBuffer({size: 32}).toString('hex').should.equal('729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2');
    });

  });

  describe('#parseDER', function() {

    it('should parse this signature generated in node', function() {
      var sighex = '30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72';
      var sig = new Buffer(sighex, 'hex');
      var parsed = Signature.parseDER(sig);
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
      var parsed = Signature.parseDER(sig);
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
      var parsed = Signature.parseDER(sig);
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

  describe('#toDER', function() {

    it('should convert these known r and s values into a known signature', function() {
      var r = BN('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      var s = BN('4331694221846364448463828256391194279133231453999942381442030409253074198130');
      var sig = new Signature({r: r, s: s});
      var der = sig.toDER(r, s);
      der.toString('hex').should.equal('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72');
    });

  });

  describe('#toString', function() {

    it('should convert this signature in to hex DER', function() {
      var r = BN('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      var s = BN('4331694221846364448463828256391194279133231453999942381442030409253074198130');
      var sig = new Signature({r: r, s: s});
      var hex = sig.toString();
      hex.should.equal('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72');
    });

  });

});
