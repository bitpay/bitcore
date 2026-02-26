'use strict';

var _ = require('lodash');
var should = require('chai').should();
var bitcore = require('../..');
var BN = bitcore.crypto.BN;
var Signature = bitcore.crypto.Signature;
var JSUtil = bitcore.util.js;
var Interpreter = bitcore.Script.Interpreter;

var sig_canonical = require('../data/bitcoind/sig_canonical');
var sig_noncanonical = require('../data/bitcoind/sig_noncanonical');

describe('Signature', function() {

  it('should make a blank signature', function() {
    var sig = new Signature();
    should.exist(sig);
  });

  it('should work with conveniently setting r, s', function() {
    var r = new BN();
    var s = new BN();
    var sig = new Signature(r, s);
    should.exist(sig);
    sig.r.toString().should.equal(r.toString());
    sig.s.toString().should.equal(s.toString());
  });

  describe('#set', function() {

    it('should set compressed', function() {
      should.exist(Signature().set({
        compressed: true
      }));
    });

    it('should set nhashtype', function() {
      var sig = Signature().set({
        nhashtype: Signature.SIGHASH_ALL
      });
      sig.nhashtype.should.equal(Signature.SIGHASH_ALL);
      sig.set({
        nhashtype: Signature.SIGHASH_ALL | Signature.SIGHASH_ANYONECANPAY
      });
      sig.nhashtype.should.equal(Signature.SIGHASH_ALL | Signature.SIGHASH_ANYONECANPAY);
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
      var sig = Signature.fromCompact(compressed);
      sig.r.cmp(BN.Zero).should.equal(0);
      sig.s.cmp(BN.Zero).should.equal(0);
      sig.compressed.should.equal(true);
    });

    it('should create a signature from an uncompressed signature', function() {
      var sigHexaStr = '1cd5e61ab5bfd0d1450997894cb1a53e917f89d82eb43f06fa96f32c96e061aec12fc1188e8b' +
        '0dc553a2588be2b5b68dbbd7f092894aa3397786e9c769c5348dc6';
      var sig = Signature.fromCompact(new Buffer(sigHexaStr, 'hex'));
      var r = 'd5e61ab5bfd0d1450997894cb1a53e917f89d82eb43f06fa96f32c96e061aec1';
      var s = '2fc1188e8b0dc553a2588be2b5b68dbbd7f092894aa3397786e9c769c5348dc6';
      sig.r.toString('hex').should.equal(r);
      sig.s.toString('hex').should.equal(s);
      sig.compressed.should.equal(false);
    });

  });

  describe('#fromDER', function() {

    var buf = new Buffer('3044022075fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e62770220729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2', 'hex');

    it('should parse this DER format signature', function() {
      var sig = Signature.fromDER(buf);
      sig.r.toBuffer({
        size: 32
      }).toString('hex').should.equal('75fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e6277');
      sig.s.toBuffer({
        size: 32
      }).toString('hex').should.equal('729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2');
    });

  });

  describe('#fromString', function() {

    var buf = new Buffer('3044022075fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e62770220729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2', 'hex');

    it('should parse this DER format signature in hex', function() {
      var sig = Signature.fromString(buf.toString('hex'));
      sig.r.toBuffer({
        size: 32
      }).toString('hex').should.equal('75fc517e541bd54769c080b64397e32161c850f6c1b2b67a5c433affbb3e6277');
      sig.s.toBuffer({
        size: 32
      }).toString('hex').should.equal('729e85cc46ffab881065ec07694220e71d4df9b2b8c8fd12c3122cf3a5efbcf2');
    });

  });

  describe('#toTxFormat', function() {

    it('should parse this known signature and rebuild it with updated zero-padded sighash types', function() {
      var original = '30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e7201';
      var buf = new Buffer(original, 'hex');
      var sig = Signature.fromTxFormat(buf);
      sig.nhashtype.should.equal(Signature.SIGHASH_ALL);
      sig.set({
        nhashtype: Signature.SIGHASH_ALL | Signature.SIGHASH_ANYONECANPAY
      });
      sig.toTxFormat().toString('hex').should.equal(original.slice(0, -2) + '81');
      sig.set({
        nhashtype: Signature.SIGHASH_SINGLE
      });
      sig.toTxFormat().toString('hex').should.equal(original.slice(0, -2) + '03');
    });

  });

  describe('#fromTxFormat', function() {

    it('should convert from this known tx-format buffer', function() {
      var buf = new Buffer('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e7201', 'hex');
      var sig = Signature.fromTxFormat(buf);
      sig.r.toString().should.equal('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      sig.s.toString().should.equal('4331694221846364448463828256391194279133231453999942381442030409253074198130');
      sig.nhashtype.should.equal(Signature.SIGHASH_ALL);
    });

    it('should parse this known signature and rebuild it', function() {
      var hex = '3044022007415aa37ce7eaa6146001ac8bdefca0ddcba0e37c5dc08c4ac99392124ebac802207d382307fd53f65778b07b9c63b6e196edeadf0be719130c5db21ff1e700d67501';
      var buf = new Buffer(hex, 'hex');
      var sig = Signature.fromTxFormat(buf);
      sig.toTxFormat().toString('hex').should.equal(hex);
    });

  });

  describe('#parseDER', function() {

    it('should parse this signature generated in node', function() {
      var sighex = '30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72';
      var sig = new Buffer(sighex, 'hex');
      var parsed = Signature.parseDER(sig);
      parsed.header.should.equal(0x30);
      parsed.length.should.equal(69);
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
      parsed.header.should.equal(0x30);
      parsed.length.should.equal(67);
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
      parsed.header.should.equal(0x30);
      parsed.length.should.equal(66);
      parsed.rlength.should.equal(30);
      parsed.rneg.should.equal(false);
      parsed.rbuf.toString('hex').should.equal('17cfe77536c3fb0526bd1a72d7a8e0973f463add210be14063c8a9c37632');
      parsed.r.toString().should.equal('164345250294671732127776123343329699648286106708464198588053542748255794');
      parsed.slength.should.equal(32);
      parsed.sneg.should.equal(false);
      parsed.sbuf.toString('hex').should.equal('61bfa677f825ded82ba0863fb0c46ca1388dd3e647f6a93c038168b59d131a51');
      parsed.s.toString().should.equal('44212963026209759051804639008236126356702363229859210154760104982946304432721');
    });

    it('should parse this signature from script_valid.json', function() {
      var sighex = '304502203e4516da7253cf068effec6b95c41221c0cf3a8e6ccb8cbf1725b562e9afde2c022100ab1e3da73d67e32045a20e0b999e049978ea8d6ee5480d485fcf2ce0d03b2ef051';
      var sig = Buffer(sighex, 'hex');
      var parsed = Signature.parseDER(sig, false);
      should.exist(parsed);
    });

  });

  describe('#toDER', function() {

    it('should convert these known r and s values into a known signature', function() {
      var r = new BN('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      var s = new BN('4331694221846364448463828256391194279133231453999942381442030409253074198130');
      var sig = new Signature({
        r: r,
        s: s
      });
      var der = sig.toDER(r, s);
      der.toString('hex').should.equal('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72');
    });

  });

  describe('#toString', function() {
    it('should convert this signature in to hex DER', function() {
      var r = new BN('63173831029936981022572627018246571655303050627048489594159321588908385378810');
      var s = new BN('4331694221846364448463828256391194279133231453999942381442030409253074198130');
      var sig = new Signature({
        r: r,
        s: s
      });
      var hex = sig.toString();
      hex.should.equal('30450221008bab1f0a2ff2f9cb8992173d8ad73c229d31ea8e10b0f4d4ae1a0d8ed76021fa02200993a6ec81755b9111762fc2cf8e3ede73047515622792110867d12654275e72');
    });
  });


  describe('@isTxDER', function() {
    it('should know this is a DER signature', function() {
      var sighex = '3042021e17cfe77536c3fb0526bd1a72d7a8e0973f463add210be14063c8a9c37632022061bfa677f825ded82ba0863fb0c46ca1388dd3e647f6a93c038168b59d131a5101';
      var sigbuf = new Buffer(sighex, 'hex');
      Signature.isTxDER(sigbuf).should.equal(true);
    });

    it('should know this is not a DER signature', function() {
      //for more extensive tests, see the script interpreter
      var sighex = '3042021e17cfe77536c3fb0526bd1a72d7a8e0973f463add210be14063c8a9c37632022061bfa677f825ded82ba0863fb0c46ca1388dd3e647f6a93c038168b59d131a5101';
      var sigbuf = new Buffer(sighex, 'hex');
      sigbuf[0] = 0x31;
      Signature.isTxDER(sigbuf).should.equal(false);
    });


    describe('bitcoind fixtures', function() {
      var test_sigs = function(set, expected) {
        var i = 0;
        set.forEach(function(vector) {
          if (!JSUtil.isHexa(vector)) {
            // non-hex strings are ignored
            return;
          }
          it('should be ' + (expected ? '' : 'in') + 'valid for fixture #' + i, function() {
            var sighex = vector;
            var interp = Interpreter();
            interp.flags = Interpreter.SCRIPT_VERIFY_DERSIG |
              Interpreter.SCRIPT_VERIFY_STRICTENC;
            var result = interp.checkSignatureEncoding(new Buffer(sighex, 'hex'));
            result.should.equal(expected);
          });
          i++;
        });
      };
      test_sigs(sig_canonical, true);
      test_sigs(sig_noncanonical, false);
    });

  });
  describe('#hasLowS', function() {
    it('should detect high and low S', function() {
      var r = new BN('63173831029936981022572627018246571655303050627048489594159321588908385378810');

      var sig = new Signature({
        r: r,
        s: new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A1', 'hex')
      });            
      sig.hasLowS().should.equal(false);

      var sig2 = new Signature({
        r: r,
        s: new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 'hex')
      });      
      sig2.hasLowS().should.equal(true);

      var sig3 = new Signature({
        r: r,
        s: new BN(1)
      });      
      sig3.hasLowS().should.equal(true);

      var sig4 = new Signature({        
        r: r,
        s: new BN(0)
      });
      sig4.hasLowS().should.equal(false);

    });
  });

  describe('#hasDefinedHashtype', function() {
    it('should reject invalid sighash types and accept valid ones', function() {
      var sig = new Signature();
      sig.hasDefinedHashtype().should.equal(false);
      var testCases = [
        [undefined, false],
        [null, false],
        [0, false],
        [1.1, false],
        [-1, false],
        [-1.1, false],
        ['', false],
        ['1', false],
        [Signature.SIGHASH_ANYONECANPAY, false],
        [Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL, true],
        [Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_NONE, true],
        [Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE, true],
        [Signature.SIGHASH_ALL, true],
        [Signature.SIGHASH_NONE, true],
        [Signature.SIGHASH_SINGLE, true],
        [Signature.SIGHASH_SINGLE + 1, false],
        [(Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE) + 1, false],
        [(Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL) - 1, false],
      ];
      _.each(testCases, function(testCase) {
        sig.nhashtype = testCase[0];
        sig.hasDefinedHashtype().should.equal(testCase[1]);
      });
    });
  });

});
