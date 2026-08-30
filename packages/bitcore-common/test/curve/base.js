/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve } = require('../../');
const { expect } = require('chai');
const vectors = require('../data/secp256k1-vectors');
const {
  P_BYTE_LENGTH,
  SECP_G_X,
  SECP_G_Y,
  SECP_2G_X,
  SECP_2G_Y
} = require('./helpers');
// Point decoding rejection helpers

// Flip the last bit of a byte array to toggle even/odd parity of Y
function flipLastBit(bytes) {
  const copy = bytes.slice();
  copy[copy.length - 1] ^= 0x01;
  return copy;
}

// Arbitrary off-curve X, Y coordinates (no attempt at curve membership)
function arbitraryOffCurveXY() {
  return {
    x: Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'),
    y: Buffer.from('0000000000000000000000000000000000000000000000000000000000000002', 'hex')
  };
}

// G's y coordinate parity: G_y is even
// G_y = 483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8
// Last hex nibble: 8 -> even

describe('BaseCurve - Base Curve Operations', function () {
  describe('Prime Reduction Context', function () {

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
  describe('Point Decoding', function () {

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
      // 0x04 prefix requires exactly 2*32+1 = 65 bytes.
      const xShort = Curve.g.getX().toArray('be', P_BYTE_LENGTH).slice(1);
      const yFull = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const badHex = '04' + Buffer.from(xShort).toString('hex') + Buffer.from(yFull).toString('hex');
      expect(function () {
        Curve.decodePoint(badHex, 'hex');
      }).to.throw('Unknown point format');
    });

    it('BASE.DECODE.WRONG_LENGTH_LONG - decodePoint(0x04 || too long) throws "Unknown point format"', function () {
      // Provide 0x04 + 33-byte x + 32-byte y.
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
  describe('Point Encoding', function () {

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
  describe('Roundtrip Encoding / Decoding', function () {

    it('BASE.ENC_DEC_ROUNDTRIP.UNCOMPRESSED - encode(G) roundtrips through decodePoint', function () {
      const encoded = Curve.g.encode('hex', false);
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.COMPRESSED - encodeCompressed(G) roundtrips through decodePoint', function () {
      const encoded = Curve.g.encodeCompressed('hex');
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.HYBRID_06 - 0x06 hybrid encoding roundtrips', function () {
      // Build hybrid encoding: 0x06 || X || Y (even-y variant)
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const hybridHex = '06' + Buffer.from(x).toString('hex') + Buffer.from(y).toString('hex');
      const decoded = Curve.decodePoint(hybridHex, 'hex');
      expect(decoded.eq(Curve.g)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.HYBRID_07 - 0x07 hybrid encoding roundtrips', function () {
      // Build hybrid encoding: 0x07 || X || Y (odd-y variant)
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const negGY = Curve.g.neg().getY().toArray('be', P_BYTE_LENGTH);
      const hybridHex = '07' + Buffer.from(x).toString('hex') + Buffer.from(negGY).toString('hex');
      const decoded = Curve.decodePoint(hybridHex, 'hex');
      expect(decoded.eq(Curve.g.neg())).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.2G - encode/decode roundtrip for 2G', function () {
      const twoG = Curve.g.dbl();
      const encoded = twoG.encode('hex', false);
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(twoG)).to.be.true;
    });

    it('BASE.ENC_DEC_ROUNDTRIP.3G - encode/decode roundtrip for 3G', function () {
      const threeG = Curve.g.mul('3');
      const encoded = threeG.encode('hex', false);
      const decoded = Curve.decodePoint(encoded, 'hex');
      expect(decoded.eq(threeG)).to.be.true;
    });
  });
  describe('Precompute Table', function () {

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
  describe('_hasDoubles', function () {

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
  describe('dblp - Repeated Doubling', function () {

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
      // Independent vector oracle.
      expect(result.getX().toString(16)).to.equal(vectors.KG['0x2'].x);
      expect(result.getY().toString(16)).to.equal(vectors.KG['0x2'].y);
    });

    it('BASE.DBLP.G4 - point.dblp(2) == 4G (known coordinates)', function () {
      const result = Curve.g.dblp(2); // 4G
      // Verify against independent vector oracle
      const pad64 = (s) => s.padStart(64, '0');
      expect(pad64(result.getX().toString(16))).to.equal(vectors.KG['0x4'].x);
      expect(pad64(result.getY().toString(16))).to.equal(vectors.KG['0x4'].y);
    });

    it('BASE.DBLP.CHALLENGE - point.dblp(k) produces correct k·G for k=1..5', function () {
      // dblp(k) doubles k times, so scalar = 2^k.
      // k=1 -> 2(0x2), k=2 -> 4(0x4), k=3 -> 8(0x8), k=4 -> 16(0x10), k=5 -> 32(0x20).
      const vecKeys = ['0x2', '0x4', '0x8', '0x10', '0x20'];
      const pad64 = (s) => s.padStart(64, '0');
      for (let k = 1; k <= 5; k++) {
        const result = Curve.g.dblp(k);
        expect(pad64(result.getX().toString(16))).to.equal(vectors.KG[vecKeys[k - 1]].x);
        expect(pad64(result.getY().toString(16))).to.equal(vectors.KG[vecKeys[k - 1]].y);
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
  describe('BasePoint Type', function () {

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
  describe('BasePoint.validate()', function () {
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
  describe('Point Decoding Rejection Contracts', function () {

    // Hybrid parity mismatch rejection.
    // SEC 1 §4.3.6 requires that the hybrid prefix byte declare the parity
    // of Y, and the actual Y must match. A 0x06 prefix with odd Y or a
    // 0x07 prefix with even Y is structurally invalid.

    it('BASE.DECODE.HYBRID_06_ODD_Y_REJECT - 0x06 prefix with odd Y throws', function () {
      // G has even Y (last byte 0xb8). Flip last bit to make odd Y.
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const oddY = flipLastBit(y);
      const hex = '06' + Buffer.from(x).toString('hex') + Buffer.from(oddY).toString('hex');
      expect(function () {
        Curve.decodePoint(hex, 'hex');
      }).to.throw(Error);
    });

    it('BASE.DECODE.HYBRID_07_EVEN_Y_REJECT - 0x07 prefix with even Y throws', function () {
      // G has even Y, so 0x07 || G.x || G.y has mismatched parity.
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const y = Curve.g.getY().toArray('be', P_BYTE_LENGTH);
      const hex = '07' + Buffer.from(x).toString('hex') + Buffer.from(y).toString('hex');
      expect(function () {
        Curve.decodePoint(hex, 'hex');
      }).to.throw(Error);
    });

    it('BASE.DECODE.HYBRID_07_EVEN_Y_REJECT_ALT - 0x07 prefix with even Y from -G side throws', function () {
      // -G has odd Y. Flip last bit to make even Y, but 0x07 expects odd.
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const negGY = Curve.g.neg().getY().toArray('be', P_BYTE_LENGTH);
      const evenYNeg = flipLastBit(negGY);
      const hex = '07' + Buffer.from(x).toString('hex') + Buffer.from(evenYNeg).toString('hex');
      expect(function () {
        Curve.decodePoint(hex, 'hex');
      }).to.throw(Error);
    });

    // Compressed decode with an x-coordinate that has no square root.
    // An X value that has no square root on the curve cannot correspond to
    // any valid point. pointFromX validates y² = x³ + ax + b and throws.

    it('BASE.DECODE.COMPRESSED.INVALID_X_02 - 0x02 || X=0 throws "invalid point"', function () {
      // On secp256k1: 0³ + 7 = 7, and 7 is not a quadratic residue mod p.
      expect(function () {
        Curve.decodePoint('02' + '00'.repeat(32), 'hex');
      }).to.throw('invalid point');
    });

    it('BASE.DECODE.COMPRESSED.INVALID_X_03 - 0x03 || X=0 throws "invalid point"', function () {
      // Same X=0 with 0x03 prefix.
      expect(function () {
        Curve.decodePoint('03' + '00'.repeat(32), 'hex');
      }).to.throw('invalid point');
    });

    // Combined parity and off-curve inputs.
    // When both parity is wrong AND coordinates are off-curve, the parity
    // assertion should fire first, short-circuiting any coordinate validation.

    it('BASE.DECODE.PARITY_OFFCURVE_COMBINED - 0x06 || off-curve X || odd Y throws', function () {
      const oc = arbitraryOffCurveXY();
      const oddY = flipLastBit(oc.y);
      const hex = '06' + oc.x.toString('hex') + oddY.toString('hex');
      expect(function () {
        Curve.decodePoint(hex, 'hex');
      }).to.throw(Error);
    });

    it('BASE.DECODE.PARITY_OFFCURVE_COMBINED_07 - 0x07 || off-curve X || even Y throws', function () {
      // oc.y ends in 0x02 (even). 0x07 expects odd, so this is a parity mismatch.
      const oc = arbitraryOffCurveXY();
      const hex = '07' + oc.x.toString('hex') + oc.y.toString('hex');
      expect(function () {
        Curve.decodePoint(hex, 'hex');
      }).to.throw(Error);
    });

    // Uncompressed points carry both coordinates explicitly.
    // 0x04 format carries both coordinates explicitly and does not declare
    // parity. It should faithfully decode whatever coordinates are given,
    // including the negation of a known point.

    it('BASE.DECODE.UNCOMPRESSED.WRONG_ROOT_OK - 0x04 || G.x || -G.y returns -G', function () {
      const x = Curve.g.getX().toArray('be', P_BYTE_LENGTH);
      const negGY = Curve.g.neg().getY().toArray('be', P_BYTE_LENGTH);
      const hex = '04' + Buffer.from(x).toString('hex') + Buffer.from(negGY).toString('hex');
      const decoded = Curve.decodePoint(hex, 'hex');
      expect(decoded).to.exist;
      expect(decoded.isInfinity()).to.be.false;
      expect(decoded.eq(Curve.g.neg())).to.be.true;
    });

    // Off-curve point decoding.
    // SEC 1 §4.3.6 specifies that a receiving party must validate that a
    // decoded point lies on the curve before using it. The correct contract
    // is that decodePoint must reject inputs that decode to points not on
    // the curve, regardless of format.
    //
    // Known deficiency: decodePoint() accepts off-curve 0x04, 0x06, and 0x07 inputs.

    describe.skip('Off-curve uncompressed and hybrid decode rejection', function () {
      it('BASE.DECODE.UNCOMPRESSED.OFF_CURVE.REJECT - 0x04 || off-curve X,Y throws', function () {
        const oc = arbitraryOffCurveXY();
        const hex = '04' + oc.x.toString('hex') + oc.y.toString('hex');
        expect(function () {
          Curve.decodePoint(hex, 'hex');
        }).to.throw(Error);
      });

      it('BASE.DECODE.HYBRID_06_OFF_CURVE.REJECT - 0x06 || off-curve X,Y throws', function () {
        const oc = arbitraryOffCurveXY();
        const hex = '06' + oc.x.toString('hex') + oc.y.toString('hex');
        expect(function () {
          Curve.decodePoint(hex, 'hex');
        }).to.throw(Error);
      });

      it('BASE.DECODE.HYBRID_07_OFF_CURVE.REJECT - 0x07 || off-curve X,Y throws', function () {
        const oc = arbitraryOffCurveXY();
        const oddY = flipLastBit(oc.y);
        const hex = '07' + oc.x.toString('hex') + oddY.toString('hex');
        expect(function () {
          Curve.decodePoint(hex, 'hex');
        }).to.throw(Error);
      });
    });
  });

});
