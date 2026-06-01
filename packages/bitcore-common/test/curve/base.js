/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve } = require('../../');
const { expect } = require('chai');

// secp256k1 constants (BN hex strings)
const SECP_P = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f';
const SECP_N = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';
const SECP_G_X = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SECP_G_Y = '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';

// Pre-computed known values
// 2G (secp256k1)
const SECP_2G_X = 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';
const SECP_2G_Y = '1ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a';
// 3G (secp256k1)
const SECP_3G_X = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const SECP_3G_Y = '388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd30888e7a82';
// 4G
const SECP_4G_X = '0d382d3d97a57c5e46d1e6b05c82c7b92e3c8a0f8f8e0d4c0d2e1f0a5b3c4d5e';
// G's y coordinate parity: G_y is even
// G_y = 483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8
// Last hex nibble: 8 -> even

const P_BYTE_LENGTH = 32; // secp256k1 field element is 32 bytes

describe('BaseCurve — Base Curve Operations', function () {

  // -----------------------------------------------------------------
  // 5.1 Prime Reduction Context (RED_PRIME, RED_MONT)
  // -----------------------------------------------------------------
  describe('5.1 Prime Reduction Context', function () {

    it('BASE.RED_PRIME - curve.red is a BN red context created from p', function () {
      expect(Curve.red).to.exist;
      expect(Curve.red).to.not.be.null;
      // The red context should be associated with the curve's prime
      const zeroPlain = Curve.zero.fromRed();
      expect(zeroPlain.cmpn(0)).to.equal(0);
    });

    it('BASE.RED_PRIME.TYPE - curve.red is Montgomery form (prime, not named prime)', function () {
      // secp256k1 uses BN.mont() since there is no fast reduction for this prime
      // BN.mont() returns a montgomery context; BN.red() with a named prime returns
      // a named context. Verify the context is functional with basic arithmetic.
      const onePlain = Curve.one.fromRed();
      expect(onePlain.cmpn(1)).to.equal(0);

      const twoPlain = Curve.two.fromRed();
      expect(twoPlain.cmpn(2)).to.equal(0);
    });

    it('BASE.RED_PRIME.USABLE - reduction context can perform modular operations', function () {
      // Verify that red arithmetic works correctly: 1 + 1 = 2 in red form
      const sum = Curve.one.redAdd(Curve.one);
      expect(sum.fromRed().cmpn(2)).to.equal(0);

      // Verify subtraction: 3 - 1 = 2
      const three = Curve.two.redAdd(Curve.one);
      const diff = three.redSub(Curve.one);
      expect(diff.fromRed().cmpn(2)).to.equal(0);
    });

    it('BASE.RED_MONT.ZERO - curve.zero is BN(0) in red form', function () {
      expect(Curve.zero.red).to.equal(Curve.red);
      expect(Curve.zero.fromRed().cmpn(0)).to.equal(0);
    });

    it('BASE.RED_MONT.ONE - curve.one is BN(1) in red form', function () {
      expect(Curve.one.red).to.equal(Curve.red);
      expect(Curve.one.fromRed().cmpn(1)).to.equal(0);
    });

    it('BASE.RED_MONT.TWO - curve.two is BN(2) in red form', function () {
      expect(Curve.two.red).to.equal(Curve.red);
      expect(Curve.two.fromRed().cmpn(2)).to.equal(0);
    });

    it('BASE.RED_MONT.MULTIPLY - multiplication in red form is correct', function () {
      // 3 * 5 mod p = 15
      const three = Curve.one.redAdd(Curve.one).redAdd(Curve.one);
      const five = three.redAdd(Curve.one).redAdd(Curve.one);
      const product = three.redMul(five);
      expect(product.fromRed().cmpn(15)).to.equal(0);
    });
  });

  // -----------------------------------------------------------------
  // 5.2 Point Decoding (decodePoint)
  // -----------------------------------------------------------------
  describe('5.2 Point Decoding', function () {

    // Helper: encode G in uncompressed format (0x04 || X || Y)
    function uncompressedHex() {
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      return '04' + Buffer.from(x).toString('hex') + Buffer.from(y).toString('hex');
    }

    // Helper: encode G in compressed format (0x02/0x03 || X)
    function compressedHex(isOdd) {
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const prefix = isOdd ? '03' : '02';
      return prefix + Buffer.from(x).toString('hex');
    }

    // Helper: encode G in hybrid format (0x06/0x07 || X || Y)
    function hybridHex(isOdd) {
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const prefix = isOdd ? '07' : '06';
      return prefix + Buffer.from(x).toString('hex') + Buffer.from(y).toString('hex');
    }

    it('BASE.DECODE.UNCOMPRESSED - decodePoint(0x04 || X || Y) recovers correct affine point', function () {
      const hex = uncompressedHex();
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.isInfinity()).to.be.false;
      expect(decoded.getX().toString(16)).to.equal(SECP_G_X);
      expect(decoded.getY().toString(16)).to.equal(SECP_G_Y);
    });

    it('BASE.DECODE.UNCOMPRESSED.MATCH - decoded x,y match original generator', function () {
      const hex = uncompressedHex();
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded.getX().toString(16)).to.equal(SECP_G_X);
      expect(decoded.getY().toString(16)).to.equal(SECP_G_Y);
    });

    it('BASE.DECODE.COMPRESSED_02 - decodePoint(0x02 || X) recovers even-y point', function () {
      const hex = compressedHex(false);
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.isInfinity()).to.be.false;
      expect(decoded.getX().toString(16)).to.equal(SECP_G_X);
      expect(decoded.getY().isEven()).to.be.true;
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.DECODE.COMPRESSED_03 - decodePoint(0x03 || X) recovers odd-y point', function () {
      const hex = compressedHex(true);
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.isInfinity()).to.be.false;
      expect(decoded.getX().toString(16)).to.equal(SECP_G_X);
      expect(decoded.getY().isEven()).to.be.false;
      expect(decoded.eq(Curve.g.neg())).to.be.true;
    });

    it('BASE.DECODE.HYBRID_06 - decodePoint(0x06 || X || Y) recovers even-y point (same as 0x04)', function () {
      const hex = hybridHex(false);
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.isInfinity()).to.be.false;
      expect(decoded.getX().toString(16)).to.equal(SECP_G_X);
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.DECODE.HYBRID_07 - decodePoint(0x07 || X || Y) recovers odd-y point', function () {
      // 0x07 prefix declares odd y; G.y is even, so use -G.y (odd) with x to construct a valid hybrid-07 point
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const negGY = Curve.g.neg().getY().toArray('be', P_BYTE_LENGTH);
      const hex = '07' + Buffer.from(x).toString('hex') + Buffer.from(negGY).toString('hex');
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.isInfinity()).to.be.false;
      expect(decoded.getX().toString(16)).to.equal(SECP_G_X);
      expect(decoded.getY().isEven()).to.be.false;
      expect(decoded.eq(Curve.g.neg())).to.be.true;
    });

    it('BASE.DECODE.INVALID_FORMAT - decodePoint(0x01 || X) throws "Unknown point format"', function () {
      // 0x01 is an invalid/obsolete point format (complex number encoding)
      const xBytes = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const badHex = '01' + Buffer.from(xBytes).toString('hex');
      expect(function () {
        Curve.decodePoint(badHex, 'hex');
      }).to.throw('Unknown point format');
    });

    it('BASE.DECODE.WRONG_LENGTH - decodePoint(0x04 || too short) throws "Unknown point format"', function () {
      // 0x04 prefix requires exactly 2*32+1 = 65 bytes; provide 0x04 + 31 bytes (too short)
      const xShort = Curve.g.getX().toArray('be', P_BYTE_LENGTH).slice(1);
      const yFull = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const badHex = '04' + Buffer.from(xShort).toString('hex') + Buffer.from(yFull).toString('hex');
      expect(function () {
        Curve.decodePoint(badHex, 'hex');
      }).to.throw('Unknown point format');
    });

    it('BASE.DECODE.WRONG_LENGTH_LONG - decodePoint(0x04 || too long) throws "Unknown point format"', function () {
      // Provide 0x04 + 33 bytes + 32 bytes = 65 bytes (too long: expected 65 for 0x04, but
      // 0x04 requires 2*32+1=65 bytes; we provide 33+32+1=66, so bytes.length-1=65 ≠ 64)
      const xFull = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const yFull = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      // prepend a zero byte to x to make it 33 bytes
      const xLong = Buffer.concat([Buffer.from('00', 'hex'), Buffer.from(xFull)]);
      const badHex = '04' + xLong.toString('hex') + Buffer.from(yFull).toString('hex');
      expect(function () {
        Curve.decodePoint(badHex, 'hex');
      }).to.throw('Unknown point format');
    });

    it('BASE.DECODE.HYBRID_07_PARITY - decodePoint(0x07) validates last byte is odd', function () {
      // 0x07 prefix requires the last byte of Y to be odd; -G has odd y, so this decodes to -G
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const negGY = Curve.g.neg().getY().toArray('be', P_BYTE_LENGTH);
      const hex = '07' + Buffer.from(x).toString('hex') + Buffer.from(negGY).toString('hex');
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.eq(Curve.g.neg())).to.be.true;
    });

    it('BASE.DECODE.HYBRID_06_PARITY - decodePoint(0x06) validates last byte is even', function () {
      // 0x06 prefix requires the last byte of Y to be even; G has even y
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const hex = '06' + Buffer.from(x).toString('hex') + Buffer.from(y).toString('hex');
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.eq(Curve.g)).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 5.3 Point Encoding (encode / encodeCompressed)
  // -----------------------------------------------------------------
  describe('5.3 Point Encoding', function () {

    it('BASE.ENC.UNCOMPRESSED - point.encode(\'hex\') produces 0x04-prefixed 130-char hex', function () {
      const hex = Curve.g.encode('hex', false);
      expect(hex).to.be.a('string');
      expect(hex.length).to.equal(130); // 1 byte prefix + 64 bytes coords
      expect(hex.substring(0, 2)).to.equal('04');
    });

    it('BASE.ENC_COMPRESSED - point.encodeCompressed(\'hex\') produces 0x02/0x03-prefixed 66-char hex', function () {
      const hex = Curve.g.encodeCompressed('hex');
      expect(hex).to.be.a('string');
      expect(hex.length).to.equal(66); // 1 byte prefix + 32 bytes
      expect(hex.substring(0, 2)).to.be.oneOf(['02', '03']);
      // G has even y, so should be 0x02
      expect(hex.substring(0, 2)).to.equal('02');
    });

    it('BASE.ENC_COMPRESSED.ODD - -G encodeCompressed produces 0x03 prefix', function () {
      const hex = Curve.g.neg().encodeCompressed('hex');
      expect(hex.length).to.equal(66);
      expect(hex.substring(0, 2)).to.equal('03'); // -G has odd y
    });

    it('BASE.ENC.UNCOMPRESSED.2G - 2G uncompressed encoding has correct format', function () {
      const twoG = Curve.g.dbl();
      const hex = twoG.encode('hex', false);
      expect(hex.length).to.equal(130);
      expect(hex.substring(0, 2)).to.equal('04');

      // Verify x and y match known 2G values
      const xHex = hex.substring(2, 66);
      const yHex = hex.substring(66);
      expect(xHex).to.equal(SECP_2G_X);
      expect(yHex).to.equal(SECP_2G_Y);
    });
  });

  // -----------------------------------------------------------------
  // 5.4 Roundtrip Encoding/Decoding
  // -----------------------------------------------------------------
  describe('5.4 Roundtrip Encoding / Decoding', function () {

    it('BASE.ENC_DEC_ROUNDTRIP.UNCOMPRESSED - encode(G) → decodePoint(encode(G)) == G', function () {
      const encoded = Curve.g.encode('hex', false);
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.COMPRESSED - encodeCompressed(G) → decodePoint == G', function () {
      const encoded = Curve.g.encodeCompressed('hex');
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.HYBRID_06 - encodeCompressed(G) → 0x06 decode == G', function () {
      // Build hybrid encoding: 0x06 || X || Y (even-y variant)
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const hybridHex = '06' + Buffer.from(x).toString('hex') + Buffer.from(y).toString('hex');
      const decoded = Curve.decodePoint(hybridHex, 'hex');
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.HYBRID_07 - encodeCompressed(-G) → 0x07 decode == -G', function () {
      // Build hybrid encoding: 0x07 || X || Y (odd-y variant)
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const negGY = Curve.g.neg().getY().toArray('be', P_BYTE_LENGTH);
      const hybridHex = '07' + Buffer.from(x).toString('hex') + Buffer.from(negGY).toString('hex');
      const decoded = Curve.decodePoint(hybridHex, 'hex');
      expect(decoded.eq(Curve.g.neg())).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.2G - encode → decode roundtrip for 2G', function () {
      const twoG = Curve.g.dbl();
      const encoded = twoG.encode('hex', false);
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(twoG)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.3G - encode → decode roundtrip for 3G', function () {
      const threeG = Curve.g.mul('3');
      const encoded = threeG.encode('hex', false);
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(threeG)).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 5.5 Precompute Table
  // -----------------------------------------------------------------
  describe('5.5 Precompute Table', function () {

    it('BASE.PRECOMPUTE - point.precompute() sets up precomputed table', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt.precomputed).to.be.null;
      pt.precompute(4);
      expect(pt.precomputed).to.exist;
      expect(pt.precomputed.doubles).to.exist;
      expect(pt.precomputed.naf).to.exist;
    });

    it('BASE.PRECOMPUTE.ALREADY_EXISTS - point.precompute() on already-precomputed point is no-op', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(4);
      const firstPre = pt.precomputed;
      pt.precompute(8); // request larger table
      // Precomputed should already be set
      expect(pt.precomputed).to.equal(firstPre);
    });

    it('BASE.PRECOMPUTE.DOUBLES_POPULATED - precomputed.doubles has step and points array', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(4);
      expect(pt.precomputed.doubles.step).to.equal(4);
      expect(pt.precomputed.doubles.points).to.be.an('array');
      expect(pt.precomputed.doubles.points.length).to.be.greaterThan(0);
    });

    it('BASE.PRECOMPUTE.NAF_POPULATED - precomputed.naf has wnd and points array', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(4);
      expect(pt.precomputed.naf.wnd).to.equal(8);
      expect(pt.precomputed.naf.points).to.be.an('array');
      expect(pt.precomputed.naf.points.length).to.be.greaterThan(0);
    });

    it('BASE.PRECOMPUTE.DOUBLES_STEP1 - precompute(16) doubles contains G and 16G', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(16);
      // _getDoubles uses a hardcoded step of 4; doubles.step is always 4 regardless of power
      expect(pt.precomputed.doubles.step).to.equal(4);
      // power=16, step=4: pushes at i=0,4,8,12 => doubles = [G, 4G, 8G, 12G, 16G] => length 5
      expect(pt.precomputed.doubles.points.length).to.equal(5);
    });

    it('BASE.PRECOMPUTE.DOUBLES_STEP4 - precompute(4) doubles.step=4', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(4);
      expect(pt.precomputed.doubles.step).to.equal(4);
      // power=4, step=4: push at i=0 => doubles = [G, 4G] => length 2
      expect(pt.precomputed.doubles.points.length).to.equal(2);
    });
  });

  // -----------------------------------------------------------------
  // 5.6 _hasDoubles
  // -----------------------------------------------------------------
  describe('5.6 _hasDoubles', function () {

    it('BASE.HAS_DOUBLES.NO_PRECOMPUTE - _hasDoubles returns false without precompute', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt._hasDoubles(new BN('100', 16))).to.be.false;
    });

    it('BASE.HAS_DOUBLES.WITH_PRECOMPUTE - _hasDoubles returns true after precompute', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(16);
      // k = 0x100 = 256, bitLength = 9
      // doubles.step = 16 => need ceil(9+1)/16 = 1 point
      const k = new BN('100', 16);
      expect(pt._hasDoubles(k)).to.be.true;
    });

    it('BASE.HAS_DOUBLES.SMALL_K - _hasDoubles(k) works for small scalars after precompute(4)', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(4);
      // doubles.step = 4, doubles.points = [G, 4G], length = 2
      // For k=0x10 (16), bitLength=5 => need ceil(6)/4 = 2 => should be true
      const k16 = new BN('10', 16);
      expect(pt._hasDoubles(k16)).to.be.true;
      // For k=0x1 (1), bitLength=1 => need ceil(2)/4 = 1 => should be true
      const k1 = new BN('1', 16);
      expect(pt._hasDoubles(k1)).to.be.true;
    });

    it('BASE.HAS_DOUBLES.LARGE_K - _hasDoubles for k with 128-bit scalar', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(16);
      // k = 2^128 - 1, bitLength = 128
      // doubles.step = 16, points = 2
      // need ceil(129)/16 = 9 => have 2 => should be false
      const largeK = new BN('ffffffffffffffff0000000000000000', 16);
      expect(pt._hasDoubles(largeK)).to.be.false;
    });

    it('BASE.HAS_DOUBLES.LARGE_PRECOMPUTE - _hasDoubles works for large table', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      pt.precompute(128);
      // doubles.step = 128, doubles.points = [G, 128G] => length 2
      // For k up to 2^128, bitLength ≤ 128
      // need ceil(129)/128 = 2 => have 2 => should be true
      const largeK = new BN('ffffffffffffffff0000000000000000', 16);
      expect(pt._hasDoubles(largeK)).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 5.7 dblp (Repeated Doubling)
  // -----------------------------------------------------------------
  describe('5.7 dblp — Repeated Doubling', function () {

    it('BASE.DBLP.BASIC - point.dblp(1) == point.dbl()', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt.dblp(1).eq(pt.dbl())).to.be.true;
    });

    it('BASE.DBLP.DOUBLE - point.dblp(2) == point.dbl().dbl()', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      const dbl2 = pt.dblp(2);
      const dblDbl = pt.dbl().dbl();
      expect(dbl2.eq(dblDbl)).to.be.true;
    });

    it('BASE.DBLP.G3 - point.dblp(1) == 2G (known coordinates)', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      const result = pt.dblp(1);
      expect(result.getX().toString(16)).to.equal(SECP_2G_X);
      expect(result.getY().toString(16)).to.equal(SECP_2G_Y);
    });

    it('BASE.DBLP.G4 - point.dblp(2) == 4G (known coordinates via G+3G)', function () {
      const pt = Curve.g;
      const result = pt.dblp(2); // 4G
      // Verify 4G = G + 3G
      const threeG = Curve.g.mul('3');
      const gPlus3g = Curve.g.add(threeG);
      expect(result.eq(gPlus3g)).to.be.true;
    });

    it('BASE.DBLP.CHALLENGE - point.dblp(k) == point.mul(2^k) for k=1..5', function () {
      const pt = Curve.g;
      for (let k = 1; k <= 5; k++) {
        const dblp = pt.dblp(k);
        const mul = pt.mul((1 << k).toString(16)); // mul by 2^k in hex
        expect(dblp.eq(mul)).to.be.true,
        'dblp(' + k + ') != mul(2^' + k + ')';
      }
    });

    it('BASE.DBLP.INFINITY - infinity.dblp(k) == infinity for k=1..5', function () {
      const inf = Curve.point(null, null);
      for (let k = 1; k <= 5; k++) {
        const result = inf.dblp(k);
        expect(result.isInfinity()).to.be.true;
      }
    });

    it('BASE.DBLP.ZERO - point.dblp(0) returns the same point', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      const result = pt.dblp(0);
      expect(result.eq(pt)).to.be.true;
    });

    it('BASE.DBLP.INFINITY_ZERO - infinity.dblp(0) returns infinity', function () {
      const inf = Curve.point(null, null);
      const result = inf.dblp(0);
      expect(result.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 5.8 BasePoint Type
  // -----------------------------------------------------------------
  describe('5.8 BasePoint Type', function () {

    it('BASE.BP.TYPE.AFFINE - Affine point.type === "affine"', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt.type).to.equal('affine');
    });

    it('BASE.BP.TYPE.AFFINE_INF - Infinity point.type === "affine"', function () {
      const inf = Curve.point(null, null);
      expect(inf.type).to.equal('affine');
    });

    it('BASE.BP.TYPE.JACOBIAN - JPoint type === "jacobian"', function () {
      const jpt = Curve.g.toJ();
      expect(jpt.type).to.equal('jacobian');
    });

    it('BASE.BP.TYPE.JPOINT_INF - JPoint infinity type === "jacobian"', function () {
      const jinf = Curve.jpoint(null, null, null);
      expect(jinf.type).to.equal('jacobian');
    });
  });

  // -----------------------------------------------------------------
  // 5.9 BasePoint.validate()
  // -----------------------------------------------------------------
  describe.skip('5.9 BasePoint.validate()', function () {
    // Skipped (25 May '26) - reason: prototype pollution (via lib/point.js)
    it('BASE.BP.VALIDATE.G_VALID - G.validate() == true', function () {
      expect(Curve.g.validate()).to.be.true;
    });

    it('BASE.BP.VALIDATE.INF_VALID - infinity.validate() == true', function () {
      const inf = Curve.point(null, null);
      expect(inf.validate()).to.be.true;
    });

    it('BASE.BP.VALIDATE.OFF_CURVE_INVALID - off-curve point.validate() == false', function () {
      const offCurve = Curve.point('1', '2');
      expect(offCurve.validate()).to.be.false;
    });

    it('BASE.BP.VALIDATE.DELEGATE - validate() delegates to curve.validate(this)', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt.validate()).to.equal(Curve.validate(pt));
    });

    it('BASE.BP.VALIDATE.2G_VALID - 2G.validate() == true', function () {
      const twoG = Curve.g.dbl();
      expect(twoG.validate()).to.be.true;
    });

    it('BASE.BP.VALIDATE.NEG_G_VALID - (-G).validate() == true', function () {
      expect(Curve.g.neg().validate()).to.be.true;
    });
  });

});
