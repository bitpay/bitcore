'use strict';

var should = require('chai').should();
var bitcore = require('..');
var Script = bitcore.Script;
var Opcode = bitcore.Opcode;

describe('Script', function() {

  it('should make a new script', function() {
    var script = new Script();
    should.exist(script);
  });

  describe('#fromBuffer', function() {

    it('should parse this buffer containing an OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_0').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
    });

    it('should parse this buffer containing another OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_CHECKMULTISIG').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
    });

    it('should parse this buffer containing three bytes of data', function() {
      var buf = new Buffer([3, 1, 2, 3]);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA1 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA1').toNumber();
      buf.writeUInt8(3, 1);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA2 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA2').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer containing OP_PUSHDATA4 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
    });

    it('should parse this buffer an OP code, data, and another OP code', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 0, 1, 2, 3, 0]);
      buf[0] = Opcode('OP_0').toNumber();
      buf[1] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 2);
      buf[buf.length - 1] = Opcode('OP_0').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(3);
      script.chunks[0].should.equal(buf[0]);
      script.chunks[1].buf.toString('hex').should.equal('010203');
      script.chunks[2].should.equal(buf[buf.length - 1]);
    });

  });

  describe('#toBuffer', function() {

    it('should output this buffer containing an OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_0').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing another OP code', function() {
      var buf = new Buffer(1);
      buf[0] = Opcode('OP_CHECKMULTISIG').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].should.equal(buf[0]);
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing three bytes of data', function() {
      var buf = new Buffer([3, 1, 2, 3]);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing OP_PUSHDATA1 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA1').toNumber();
      buf.writeUInt8(3, 1);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing OP_PUSHDATA2 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA2').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer containing OP_PUSHDATA4 and three bytes of data', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 1, 2, 3]);
      buf[0] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 1);
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(1);
      script.chunks[0].buf.toString('hex').should.equal('010203');
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

    it('should output this buffer an OP code, data, and another OP code', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 0, 1, 2, 3, 0]);
      buf[0] = Opcode('OP_0').toNumber();
      buf[1] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 2);
      buf[buf.length - 1] = Opcode('OP_0').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(3);
      script.chunks[0].should.equal(buf[0]);
      script.chunks[1].buf.toString('hex').should.equal('010203');
      script.chunks[2].should.equal(buf[buf.length - 1]);
      script.toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#fromString', function() {

    it('should parse these known scripts', function() {
      Script.fromString('OP_0 OP_PUSHDATA4 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA4 3 0x010203 OP_0');
      Script.fromString('OP_0 OP_PUSHDATA2 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA2 3 0x010203 OP_0');
      Script.fromString('OP_0 OP_PUSHDATA1 3 0x010203 OP_0').toString().should.equal('OP_0 OP_PUSHDATA1 3 0x010203 OP_0');
      Script.fromString('OP_0 3 0x010203 OP_0').toString().should.equal('OP_0 3 0x010203 OP_0');
    });

  });

  describe('#toString', function() {

    it('should output this buffer an OP code, data, and another OP code', function() {
      var buf = new Buffer([0, 0, 0, 0, 0, 0, 1, 2, 3, 0]);
      buf[0] = Opcode('OP_0').toNumber();
      buf[1] = Opcode('OP_PUSHDATA4').toNumber();
      buf.writeUInt16LE(3, 2);
      buf[buf.length - 1] = Opcode('OP_0').toNumber();
      var script = Script.fromBuffer(buf);
      script.chunks.length.should.equal(3);
      script.chunks[0].should.equal(buf[0]);
      script.chunks[1].buf.toString('hex').should.equal('010203');
      script.chunks[2].should.equal(buf[buf.length - 1]);
      script.toString().toString('hex').should.equal('OP_0 OP_PUSHDATA4 3 0x010203 OP_0');
    });

  });

  describe('#isOpReturn', function() {

    it('should know this is a (blank) OP_RETURN script', function() {
      Script('OP_RETURN').isOpReturn().should.equal(true);
    });

    it('should know this is an OP_RETURN script', function() {
      var buf = new Buffer(40);
      buf.fill(0);
      Script('OP_RETURN 40 0x' + buf.toString('hex')).isOpReturn().should.equal(true);
    });

    it('should know this is not an OP_RETURN script', function() {
      var buf = new Buffer(40);
      buf.fill(0);
      Script('OP_CHECKMULTISIG 40 0x' + buf.toString('hex')).isOpReturn().should.equal(false);
    });

  });

  describe('#isPublicKeyHashIn', function() {

    it('should identify this known pubkeyhashin', function() {
      Script('73 0x3046022100bb3c194a30e460d81d34be0a230179c043a656f67e3c5c8bf47eceae7c4042ee0221008bf54ca11b2985285be0fd7a212873d243e6e73f5fad57e8eb14c4f39728b8c601 65 0x04e365859b3c78a8b7c202412b949ebca58e147dba297be29eee53cd3e1d300a6419bc780cc9aec0dc94ed194e91c8f6433f1b781ee00eac0ead2aae1e8e0712c6').isPublicKeyHashIn().should.equal(true);
    });

    it('should identify this known non-pubkeyhashin', function() {
      Script('73 0x3046022100bb3c194a30e460d81d34be0a230179c043a656f67e3c5c8bf47eceae7c4042ee0221008bf54ca11b2985285be0fd7a212873d243e6e73f5fad57e8eb14c4f39728b8c601 65 0x04e365859b3c78a8b7c202412b949ebca58e147dba297be29eee53cd3e1d300a6419bc780cc9aec0dc94ed194e91c8f6433f1b781ee00eac0ead2aae1e8e0712c6 OP_CHECKSIG').isPublicKeyHashIn().should.equal(false);
    });

  });

  describe('#isPublicKeyHashOut', function() {

    it('should identify this known pubkeyhashout as pubkeyhashout', function() {
      Script('OP_DUP OP_HASH160 20 0000000000000000000000000000000000000000 OP_EQUALVERIFY OP_CHECKSIG').isPublicKeyHashOut().should.equal(true);
    });

    it('should identify this known non-pubkeyhashout as not pubkeyhashout', function() {
      Script('OP_DUP OP_HASH160 20 0000000000000000000000000000000000000000').isPublicKeyHashOut().should.equal(false);
    });

  });

  describe('#isScripthashIn', function() {

    it('should identify this known scripthashin', function() {
      Script('OP_0 73 0x30460221008ca148504190c10eea7f5f9c283c719a37be58c3ad617928011a1bb9570901d2022100ced371a23e86af6f55ff4ce705c57d2721a09c4d192ca39d82c4239825f75a9801 72 0x30450220357011fd3b3ad2b8f2f2d01e05dc6108b51d2a245b4ef40c112d6004596f0475022100a8208c93a39e0c366b983f9a80bfaf89237fcd64ca543568badd2d18ee2e1d7501 OP_PUSHDATA1 105 0x5221024c02dff2f0b8263a562a69ec875b2c95ffad860f428acf2f9e8c6492bd067d362103546324a1351a6b601c623b463e33b6103ca444707d5b278ece1692f1aa7724a42103b1ad3b328429450069cc3f9fa80d537ee66ba1120e93f3f185a5bf686fb51e0a53ae').isScriptHashIn().should.equal(true);
    });

    it('should identify this known non-scripthashin', function() {
      Script('20 0000000000000000000000000000000000000000 OP_CHECKSIG').isScriptHashIn().should.equal(false);
    });

  });

  describe('#isScripthashOut', function() {

    it('should identify this known pubkeyhashout as pubkeyhashout', function() {
      Script('OP_HASH160 20 0x0000000000000000000000000000000000000000 OP_EQUAL').isScriptHashOut().should.equal(true);
    });

    it('should identify these known non-pubkeyhashout as not pubkeyhashout', function() {
      Script('OP_HASH160 20 0x0000000000000000000000000000000000000000 OP_EQUAL OP_EQUAL').isScriptHashOut().should.equal(false);
      Script('OP_HASH160 21 0x000000000000000000000000000000000000000000 OP_EQUAL').isScriptHashOut().should.equal(false);
    });

  });

  describe('#isMultisigOut', function() {
    it('should identify known multisig out 1', function() {
      Script('OP_2 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 OP_2 OP_CHECKMULTISIG').isMultisigOut().should.equal(true);
    });
    it('should identify known multisig out 2', function() {
      Script('OP_1 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 OP_2 OP_CHECKMULTISIG').isMultisigOut().should.equal(true);
    });
    it('should identify known multisig out 3', function() {
      Script('OP_2 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 21 0x03363d90d447b00c9c99ceac05b6262ee053441c7e55552ffe526bad8f83ff4640 OP_3 OP_CHECKMULTISIG').isMultisigOut().should.equal(true);
    });

    it('should identify non-multisig out 1', function() {
      Script('OP_2 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 OP_2 OP_CHECKMULTISIG OP_EQUAL').isMultisigOut().should.equal(false);
    });
    it('should identify non-multisig out 2', function() {
      Script('OP_2').isMultisigOut().should.equal(false);
    });
  });

  describe('#isMultisigIn', function() {
    it('should identify multisig in 1', function() {
      Script('OP_0 0x47 0x3044022002a27769ee33db258bdf7a3792e7da4143ec4001b551f73e6a190b8d1bde449d02206742c56ccd94a7a2e16ca52fc1ae4a0aa122b0014a867a80de104f9cb18e472c01').isMultisigIn().should.equal(true);
    });
    it('should identify multisig in 2', function() {
      Script('OP_0 0x47 0x3044022002a27769ee33db258bdf7a3792e7da4143ec4001b551f73e6a190b8d1bde449d02206742c56ccd94a7a2e16ca52fc1ae4a0aa122b0014a867a80de104f9cb18e472c01 0x47 30450220357011fd3b3ad2b8f2f2d01e05dc6108b51d2a245b4ef40c112d6004596f0475022100a8208c93a39e0c366b983f9a80bfaf89237fcd64ca543568badd2d18ee2e1d7501').isMultisigIn().should.equal(true);
    });
    it('should identify non-multisig in 1', function() {
      Script('0x47 0x3044022002a27769ee33db258bdf7a3792e7da4143ec4001b551f73e6a190b8d1bde449d02206742c56ccd94a7a2e16ca52fc1ae4a0aa122b0014a867a80de104f9cb18e472c01').isMultisigIn().should.equal(false);
    });
    it('should identify non-multisig in 2', function() {
      Script('OP_0 0x47 0x3044022002a27769ee33db258bdf7a3792e7da4143ec4001b551f73e6a190b8d1bde449d02206742c56ccd94a7a2e16ca52fc1ae4a0aa122b0014a867a80de104f9cb18e472c01 OP_0').isMultisigIn().should.equal(false);
    });
  });

  describe('#classify', function() {
    it('should classify public key hash out', function() {
      Script('OP_DUP OP_HASH160 20 0000000000000000000000000000000000000000 OP_EQUALVERIFY OP_CHECKSIG').classify().should.equal(Script.types.PUBKEYHASH_OUT);
    });
    it('should classify public key hash in', function() {
      Script('47 0x3044022077a8d81e656c4a1c1721e68ce35fa0b27f13c342998e75854858c12396a15ffa02206378a8c6959283c008c87a14a9c0ada5cf3934ac5ee29f1fef9cac6969783e9801 21 0x03993c230da7dabb956292851ae755f971c50532efc095a16bee07f83ab9d262df').classify().should.equal(Script.types.PUBKEYHASH_IN);
    });
    it('should classify script hash out', function() {
      Script('OP_HASH160 20 0x0000000000000000000000000000000000000000 OP_EQUAL').classify().should.equal(Script.types.SCRIPTHASH_OUT);
    });
    it('should classify script hash in', function() {
      Script('OP_0 73 0x30460221008ca148504190c10eea7f5f9c283c719a37be58c3ad617928011a1bb9570901d2022100ced371a23e86af6f55ff4ce705c57d2721a09c4d192ca39d82c4239825f75a9801 72 0x30450220357011fd3b3ad2b8f2f2d01e05dc6108b51d2a245b4ef40c112d6004596f0475022100a8208c93a39e0c366b983f9a80bfaf89237fcd64ca543568badd2d18ee2e1d7501 OP_PUSHDATA1 105 0x5221024c02dff2f0b8263a562a69ec875b2c95ffad860f428acf2f9e8c6492bd067d362103546324a1351a6b601c623b463e33b6103ca444707d5b278ece1692f1aa7724a42103b1ad3b328429450069cc3f9fa80d537ee66ba1120e93f3f185a5bf686fb51e0a53ae').classify().should.equal(Script.types.SCRIPTHASH_IN);
    });
    it('should classify MULTISIG out', function() {
      Script('OP_2 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 21 0x038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508 OP_2 OP_CHECKMULTISIG').classify().should.equal(Script.types.MULTISIG_OUT);
    });
    it('should classify MULTISIG in', function() {
      Script('OP_0 0x47 0x3044022002a27769ee33db258bdf7a3792e7da4143ec4001b551f73e6a190b8d1bde449d02206742c56ccd94a7a2e16ca52fc1ae4a0aa122b0014a867a80de104f9cb18e472c01').classify().should.equal(Script.types.MULTISIG_IN);
    });
    it('should classify OP_RETURN', function() {
      Script('OP_RETURN 1 0x01').classify().should.equal(Script.types.OP_RETURN);
    });
    it('should classify public key out', function() {
      Script('41 0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 OP_CHECKSIG').classify().should.equal(Script.types.PUBKEY_OUT);
    });
    it('should classify public key in', function() {
      Script('47 0x3044022007415aa37ce7eaa6146001ac8bdefca0ddcba0e37c5dc08c4ac99392124ebac802207d382307fd53f65778b07b9c63b6e196edeadf0be719130c5db21ff1e700d67501').classify().should.equal(Script.types.PUBKEY_IN);
    });
    it('should classify unknown', function() {
      Script('OP_TRUE OP_FALSE').classify().should.equal(Script.types.UNKNOWN);
    });
  });

  describe('#add and #prepend', function() {

    it('should add these ops', function() {
      Script().add('OP_CHECKMULTISIG').toString().should.equal('OP_CHECKMULTISIG');
      Script().add('OP_1').add('OP_2').toString().should.equal('OP_1 OP_2');
      Script().add(new Opcode('OP_CHECKMULTISIG')).toString().should.equal('OP_CHECKMULTISIG');
      Script().add(Opcode.map.OP_CHECKMULTISIG).toString().should.equal('OP_CHECKMULTISIG');
    });

    it('should prepend these ops', function() {
      Script().prepend('OP_CHECKMULTISIG').toString().should.equal('OP_CHECKMULTISIG');
      Script().prepend('OP_1').prepend('OP_2').toString().should.equal('OP_2 OP_1');
    });

    it('should add and prepend correctly', function() {
      Script().add('OP_1').prepend('OP_2').add('OP_3').prepend('OP_4').toString()
        .should.equal('OP_4 OP_2 OP_1 OP_3');
    });

    it('should add these push data', function() {
      var buf = new Buffer(1);
      buf.fill(0);
      Script().add(buf).toString().should.equal('1 0x00');
      buf = new Buffer(255);
      buf.fill(0);
      Script().add(buf).toString().should.equal('OP_PUSHDATA1 255 0x' + buf.toString('hex'));
      buf = new Buffer(256);
      buf.fill(0);
      Script().add(buf).toString().should.equal('OP_PUSHDATA2 256 0x' + buf.toString('hex'));
      buf = new Buffer(Math.pow(2, 16));
      buf.fill(0);
      Script().add(buf).toString().should.equal('OP_PUSHDATA4 ' + Math.pow(2, 16) + ' 0x' + buf.toString('hex'));
    });

    it('should add both pushdata and non-pushdata chunks', function() {
      Script().add('OP_CHECKMULTISIG').toString().should.equal('OP_CHECKMULTISIG');
      Script().add(Opcode.map.OP_CHECKMULTISIG).toString().should.equal('OP_CHECKMULTISIG');
      var buf = new Buffer(1);
      buf.fill(0);
      Script().add(buf).toString().should.equal('1 0x00');
    });
  });

});
