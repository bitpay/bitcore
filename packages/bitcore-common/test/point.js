/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Point, Curve } = require('../');
const { expect } = require('chai');
const { Buffer } = require('buffer');

// secp256k1 constants (used as BN hex strings)
const SECP_P = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f';
const SECP_N = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';
const SECP_G_X = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SECP_G_Y = '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';

describe('Point', function () {

  // -----------------------------------------------------------------
  // 2.1 Construction & Static Helpers
  // -----------------------------------------------------------------
  describe('2.1 Construction & Static Helpers', function () {

    it('P.CONSTRUCT.G - create generator G from known hex coordinates', function () {
      const g = new Point(SECP_G_X, SECP_G_Y);
      const gStatic = Point.getG();
      expect(g.eq(gStatic)).to.be.true;
    });

    it('P.CONSTRUCT.VALID - create valid non-G point (2G via scalar mul)', function () {
      const G = Point.getG();
      const G2 = G.mul('2');
      const x2 = G2.getX().toString(16);
      const y2 = G2.getY().toString(16);
      const fromCoords = new Point(x2, y2);
      expect(fromCoords.eq(G2)).to.be.true;
    });

    it('P.CONSTRUCT.INVALID_Y - y not on curve y^2 = x^3 + 7 throws', function () {
      const G = Point.getG();
      const badY = G.getY().addn(999999).toString(16);
      expect(() => new Point(G.getX().toString(16), badY)).to.throw();
    });

    it('P.CONSTRUCT.INFINITY_GUESS - Point times N must be infinity, throws if not', function () {
      // The Point wrapper's validate() checks p.mul(N).isInfinity().
      // Any coordinate pair not on the curve or of non-standard order
      // will throw during construction.
      expect(() => new Point('1', '1')).to.throw();
    });

    it('P.CONSTRUCT.ZERO_X - x=0 is not valid (no y satisfies y^2 = 0^3 + 7 = 7 on secp256k1)', function () {
      // x=0 gives x^3 + 7 = 7 which is not a quadratic residue mod p
      expect(() => new Point('0', '1')).to.throw();
    });

    it('P.CONSTRUCT.X_GT_P - x >= field p throws', function () {
      const pVal = Point.getP();
      const xTooLarge = pVal.addn(1).toString(16);
      expect(() => new Point(xTooLarge, '1')).to.throw();
    });

    it('P.GETG - Point.getG() returns generator', function () {
      const G = Point.getG();
      expect(G.getX().toString(16)).to.equal(SECP_G_X);
      expect(G.getY().toString(16)).to.equal(SECP_G_Y);
    });

    it('P.GETN - Point.getN() returns order as BN', function () {
      const N = Point.getN();
      expect(BN.isBN(N)).to.be.true;
      expect(N.toString(16)).to.equal(SECP_N);
    });

    it('P.GETP - Point.getP() returns field prime as BN', function () {
      const P = Point.getP();
      expect(BN.isBN(P)).to.be.true;
      expect(P.toString(16)).to.equal(SECP_P);
    });

    it('P.TO_COMPRESSED.VERIFY - pointToCompressed() produces 33-byte Buffer', function () {
      const G = Point.getG();
      const comp = Point.pointToCompressed(G);
      expect(Buffer.isBuffer(comp)).to.be.true;
      expect(comp.length).to.equal(33);
      // G has even Y (ends in '8'), so prefix = 0x02
      expect(comp[0]).to.equal(0x02);
      expect(comp.toString('hex').slice(2)).to.equal(SECP_G_X);
    });

    it('P.FROMX - Point.fromX(false, gX) recovers generator (even-y)', function () {
      const G = Point.getG();
      const recovered = Point.fromX(false, G.getX());
      expect(recovered.eq(G)).to.be.true;
    });

    it('P.FROMX.YODD - Point.fromX(true, x) selects odd-y branch', function () {
      const G = Point.getG();
      // G has even Y. fromX(true, G.getX()) returns the point with
      // the SAME x but the OTHER (odd) y, i.e. G.neg().
      const recovered = Point.fromX(true, G.getX());
      expect(recovered.getX().toString(16)).to.equal(G.getX().toString(16));
      expect(recovered.getY().isOdd()).to.be.true;
      expect(recovered.eq(G.neg())).to.be.true;
    });

    it('P.FROMX.INVALID - Point.fromX with invalid x throws "Invalid X"', function () {
      // x=0 gives x^3+7=7 which is not a quadratic residue mod p
      expect(() => Point.fromX(false, '0')).to.throw('Invalid X');
      // x=5 gives x^3+7=132 which is not a quadratic residue mod p
      expect(() => Point.fromX(false, '5')).to.throw('Invalid X');
    });

    it('P.FROMX.WITH_G_PRIVATE - recover P = d*G, then fromX matches', function () {
      const G = Point.getG();
      const d = new BN('2');
      const P = G.mul(d); // 2G
      // Recover 2G from its X coordinate — 2G's Y is even
      const recovered = Point.fromX(false, P.getX());
      expect(recovered.eq(P)).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 2.2 Point Addition & Doubling (Affine + Jacobian)
  // -----------------------------------------------------------------
  describe('2.2 Point Addition & Doubling', function () {

    it('P.ADD.SELF - P.dbl() vs P.add(P) produce identical results', function () {
      const G = Point.getG();
      const G2_dbl = G.dbl();
      const G2_add = G.add(G);
      expect(G2_dbl.eq(G2_add)).to.be.true;
      // Also verify with a different point (3G)
      const G3 = G.mul('3');
      expect(G3.dbl().eq(G3.add(G3))).to.be.true;
    });

    it('P.ADD.DISTINCT - two known points give known sum (algebraic check)', function () {
      const G = Point.getG();
      const G2 = G.mul('2');
      const G3 = G.mul('3');
      const sum = G2.add(G3);
      const G5 = G.mul('5');
      expect(sum.eq(G5)).to.be.true;
      // Commutative: G3 + G2 = G5
      expect(G3.add(G2).eq(G5)).to.be.true;
    });

    it('P.ADD.NEGATION - P.add(P.neg()) yields point at infinity', function () {
      const G = Point.getG();
      const negG = G.neg();
      expect(G.add(negG).isInfinity()).to.be.true;
    });

    it('P.ADD.ZERO - P.add(O) and O.add(P) both equal P', function () {
      const G = Point.getG();
      const N = Point.getN();
      const O = G.mul(N); // G * N = point at infinity
      expect(O.isInfinity()).to.be.true;
      expect(G.add(O).eq(G)).to.be.true;   // P + O = P
      expect(O.add(G).eq(G)).to.be.true;   // O + P = P
    });

    it('P.ADD.G - G.add(G) matches known 2G (via dbl)', function () {
      const G = Point.getG();
      expect(G.add(G).eq(G.dbl())).to.be.true;
    });

    it('P.DBL.G - G.dbl() matches G.add(G)', function () {
      const G = Point.getG();
      expect(G.dbl().eq(G.add(G))).to.be.true;
    });

    it('P.JPOINT.TO_P - Jacobian to affine conversion correctness', function () {
      const G = Point.getG();
      const j = G.toJ();
      const back = j.toP();
      expect(back.eq(G)).to.be.true;
    });

    it('P.JPOINT.EQ - JPoint.eq(Affine) cross-representation equality', function () {
      const G = Point.getG();
      const j = G.toJ();
      expect(j.eq(G)).to.be.true;
    });

    it('P.JPOINT.INFINITY - JPoint constructed from nulls is infinity', function () {
      const G = Point.getG();
      // Create a jacobian infinity via Curve.point(null,null).toJ()
      const jInf = Curve.point(null, null).toJ();
      expect(jInf.isInfinity()).to.be.true;
      // Also: G.mul(N) is infinity, toJ preserves that
      const jInf2 = G.mul(Point.getN()).toJ();
      expect(jInf2.isInfinity()).to.be.true;
    });

    it('P.NEG - negation flips Y, and P + P.neg() = infinity', function () {
      const G = Point.getG();
      const negG = G.neg();
      expect(negG.getX().toString(16)).to.equal(G.getX().toString(16));
      // Y should be negated in the field: p - y
      const p = new BN(SECP_P, 16);
      const expectedNegY = p.sub(new BN(G.getY().toString(16), 16)).toString(16);
      expect(negG.getY().toString(16)).to.equal(expectedNegY);
      expect(G.add(negG).isInfinity()).to.be.true;
    });

    it('P.EQ - Point equality is value-based, not reference-based', function () {
      const G = Point.getG();
      const G2 = new Point(SECP_G_X, SECP_G_Y);
      expect(G.eq(G2)).to.be.true;
      expect(G === G2).to.be.false;
      expect(G.eq(G.mul('2'))).to.be.false;
    });

    it('P.IS_INFINITY - isInfinity() returns boolean', function () {
      const G = Point.getG();
      expect(G.isInfinity()).to.be.false;
      expect(typeof G.isInfinity()).to.equal('boolean');
      const O = G.mul(Point.getN());
      expect(O.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 2.3 Scalar Multiplication
  // -----------------------------------------------------------------
  describe('2.3 Scalar Multiplication', function () {

    it('P.MUL.G_BY_2 - G.mul("2") matches G.dbl()', function () {
      const G = Point.getG();
      expect(G.mul('2').eq(G.dbl())).to.be.true;
    });

    it('P.MUL.G_BY_N - G.mul(n) yields point at infinity (secp256k1 KEY PROPERTY)', function () {
      const G = Point.getG();
      const N = Point.getN();
      expect(G.mul(N).isInfinity()).to.be.true;
    });

    it('P.MUL.G_BY_N_MINUS_1 - G.mul(n-1) equals negated G', function () {
      const G = Point.getG();
      const N = Point.getN();
      const result = G.mul(N.subn(1).toString(16));
      expect(result.eq(G.neg())).to.be.true;
    });

    it('P.MUL.G_BY_N_PLUS_1 - G.mul(n+1) equals G (wraps at order)', function () {
      const G = Point.getG();
      const N = Point.getN();
      const result = G.mul(N.addn(1).toString(16));
      expect(result.eq(G)).to.be.true;
    });

    it('P.MUL.G_BY_1 - G.mul("1") equals G', function () {
      const G = Point.getG();
      expect(G.mul('1').eq(G)).to.be.true;
    });

    it('P.MUL.G_BY_0 - G.mul("0") yields point at infinity', function () {
      const G = Point.getG();
      expect(G.mul('0').isInfinity()).to.be.true;
    });

    it('P.MUL.LARGE_SCALAR - 256-bit private key * G produces valid public key', function () {
      const G = Point.getG();
      // d = 1 -> 1*G = G
      const d = new BN('0000000000000000000000000000000000000000000000000000000000000001');
      const Q = G.mul(d);
      expect(Q.isInfinity()).to.be.false;
      expect(Q.eq(G)).to.be.true;

      // Use another 256-bit scalar
      const d2_hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const Q2 = G.mul(d2_hex);
      const d2_x2 = new BN(d2_hex, 16).muln(2).toString(16);
      const Q3 = G.mul(d2_x2);
      // (2*d)*G = 2*(d*G)
      expect(Q2.dbl().eq(Q3)).to.be.true;
    });

    it('P.MUL.HEX_SCALAR - scalar passed as hex string', function () {
      const G = Point.getG();
      expect(G.mul('2').eq(G.dbl())).to.be.true;
      expect(G.mul('3').eq(G.dbl().add(G))).to.be.true;
      const largeHex = '2000000000000000000000000000000000000000000000000000000000000001';
      const largeBN = new BN('2000000000000000000000000000000000000000000000000000000000000001', 16);
      expect(G.mul(largeHex).eq(G.mul(largeBN))).to.be.true;
    });

    it('P.MUL.JMULADD - jmulAdd(k1, P2, k2) multi-scalar multiplication in jacobian form', function () {
      const G = Point.getG();
      const G2 = G.mul('2');
      const a = new BN('3', 16);
      const b = new BN('2', 16);
      // 3*G + 2*(2G) = 3G + 4G = 7G
      const result = G.jmulAdd(a, G2, b);
      const expected = G.mul('7');
      expect(result.eq(expected)).to.be.true;
    });

    it('P.MUL.MULADD - mulAdd(k1, P2, k2) yields same result as jmulAdd in affine form', function () {
      const G = Point.getG();
      const G2 = G.mul('2');
      const a = new BN('3', 16);
      const b = new BN('2', 16);
      const result = G.mulAdd(a, G2, b);
      const expected = G.mul('7');
      expect(result.eq(expected)).to.be.true;
    });

    it('P.MUL.ASSOCIATIVE - (a*b)G == a(bG) for small scalars', function () {
      const G = Point.getG();
      // Note: Point.mul() interprets all string scalars as hexadecimal (from elliptic).
      // Single hex digits 0-9 are identical to decimal digits, so these work by coincidence.
      // (2*3)G == 2*(3G)
      const left = G.mul('6');
      const right = G.mul('3').mul('2');
      expect(left.eq(right)).to.be.true;
      // (4*5)G == 4*(5G)
      // '20' in hex = 32 decimal, NOT 20 decimal. Use '14' (hex for 20) instead.
      expect(G.mul('14').eq(G.mul('5').mul('4'))).to.be.true;
    });

    it('P.MUL.DISTRIBUTIVE - (a+b)G == aG + bG', function () {
      const G = Point.getG();
      const G3 = G.mul('3');
      const G5 = G.mul('5');
      expect(G.mul('8').eq(G3.add(G5))).to.be.true;
    });

    it('P.MUL.NEGATIVE_SCALAR - scalar wraps correctly (k mod n)', function () {
      const G = Point.getG();
      const N = Point.getN();
      // k = n + 2 -> should equal G.mul(2)
      const k = N.addn(2).toString(16);
      expect(G.mul(k).eq(G.mul('2'))).to.be.true;
    });

    it('P.MUL.ENDOMORPHISM - kG computed via endomorphism path matches doubling path', function () {
      // secp256k1 supports the lambda/Beta endomorphism.
      // G.mul(k) uses the endomorphism path when no precomputed tables exist.
      // We verify correctness by comparing to an independent path:
      // G.mul(5) == 3*G + 2*G
      const G = Point.getG();
      const result = G.mul('5');
      const verify = G.mul('3').add(G.mul('2'));
      expect(result.eq(verify)).to.be.true;
    });

    it('P.PRECOMPUTE - G.precompute() then G.mul(k) yields correct result', function () {
      const G = Point.getG();
      G.precompute();
      expect(G.mul('7').eq(Point.getG().mul('7'))).to.be.true;
      expect(G.mul('20').eq(Point.getG().mul('20'))).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 2.4 Validation
  // -----------------------------------------------------------------
  describe('2.4 Validation', function () {

    it('P.VALIDATE.G - generator passes validate()', function () {
      const G = Point.getG();
      expect(() => G.validate()).to.not.throw();
    });

    it('P.VALIDATE.NON_G - another valid point passes validate()', function () {
      const G = Point.getG();
      const P = G.mul('3');
      expect(() => P.validate()).to.not.throw();
    });

    it('P.VALIDATE.INVALID_Y - point with altered Y throws', function () {
      const G = Point.getG();
      const badY = G.getY().addn(999).toString(16);
      // Constructor calls validate(); wrong Y triggers "Invalid y value for curve."
      expect(() => new Point(G.getX().toString(16), badY)).to.throw();
    });

    it('P.VALIDATE.OFF_CURVE - point not on curve throws', function () {
      // Random coordinates are almost certainly not on the curve.
      expect(() => new Point(
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      )).to.throw();
    });

    it('P.VALIDATE.INFINITY - Infinity point throws (per API contract)', function () {
      // Point.validate() explicitly rejects infinity.
      const G = Point.getG();
      const atInfinity = G.mul(Point.getN());
      expect(atInfinity.isInfinity()).to.be.true;
      expect(() => atInfinity.validate()).to.throw('Point cannot be equal to Infinity');
    });

    it('P.VALIDATE.OUTSIDE_FIELD - x >= p throws', function () {
      const xAtP = Point.getP().toString(16);
      expect(() => new Point(xAtP, '1')).to.throw();
    });

    it('P.VALIDATE.COMPRESSED_PAIR - compressed encoding roundtrip validates', function () {
      const G = Point.getG();
      const comp = Point.pointToCompressed(G);
      // Decode the compressed form back to a point
      const decoded = Curve.decodePoint(comp);
      expect(decoded.getX().cmp(G.getX())).to.equal(0);
      expect(decoded.getY().cmp(G.getY())).to.equal(0);
    });
  });

  // -----------------------------------------------------------------
  // 2.5 Encoding & Decoding
  // -----------------------------------------------------------------
  describe('2.5 Encoding & Decoding', function () {

    it('P.ENCODE - point.encode() produces uncompressed hex (0x04 prefix)', function () {
      const G = Point.getG();
      const hex = G.encode('hex');
      expect(hex).to.be.a('string');
      expect(hex.length).to.equal(130); // 04 (2) + X (64) + Y (64)
      expect(hex.slice(0, 2)).to.equal('04');
      expect(hex.slice(2, 66)).to.equal(SECP_G_X);
      expect(hex.slice(66)).to.equal(SECP_G_Y);
    });

    it('P.ENCODE_COMPRESSED - point.encodeCompressed() produces 33-byte hex', function () {
      const G = Point.getG();
      const hex = G.encodeCompressed('hex');
      expect(hex).to.be.a('string');
      expect(hex.length).to.equal(66); // 02 (2) + X (64)
      expect(hex.slice(2)).to.equal(SECP_G_X);
    });

    it('P.ENCODE.EVEN_ODD - even Y -> 0x02 prefix, odd Y -> 0x03 prefix', function () {
      const G = Point.getG();
      // G's Y is even -> 0x02
      const gHex = G.encode('hex', true);
      expect(gHex.slice(0, 2)).to.equal('02');
      // G.neg() has odd Y -> 0x03
      const negG = G.neg();
      const negHex = negG.encode('hex', true);
      expect(negHex.slice(0, 2)).to.equal('03');
      // Verify a point known to have odd Y
      const G3 = G.mul('3');
      const g3Hex = G3.encode('hex', true);
      expect(['02', '03']).to.include(g3Hex.slice(0, 2));
      if (g3Hex.slice(0, 2) === '02') {
        expect(G3.getY().isOdd()).to.be.false;
      } else {
        expect(G3.getY().isOdd()).to.be.true;
      }
    });

    it('P.DECODE.UNCOMPRESSED - decode 0x04 prefix -> Point', function () {
      const G = Point.getG();
      const uncompr = Buffer.from(G.encode('hex'), 'hex');
      // decodePoint requires a Buffer (not hex string per our earlier investigation)
      const decoded = Curve.decodePoint(uncompr);
      expect(decoded.getX().cmp(G.getX())).to.equal(0);
      expect(decoded.getY().cmp(G.getY())).to.equal(0);
    });

    it('P.DECODE.COMPRESSED_02 - decode 0x02 prefix -> correct point (even Y)', function () {
      const G = Point.getG();
      const comp = Buffer.from(G.encode('hex', true), 'hex');
      expect(comp[0]).to.equal(0x02);
      const decoded = Curve.decodePoint(comp);
      expect(decoded.getX().cmp(G.getX())).to.equal(0);
      expect(decoded.getY().cmp(G.getY())).to.equal(0);
    });

    it('P.DECODE.COMPRESSED_03 - decode 0x03 prefix -> correct point (odd Y)', function () {
      const G = Point.getG();
      const negG = G.neg();
      const comp = Buffer.from(negG.encode('hex', true), 'hex');
      expect(comp[0]).to.equal(0x03);
      const decoded = Curve.decodePoint(comp);
      expect(decoded.getX().cmp(G.getX())).to.equal(0);  // same X as G
      expect(decoded.getY().cmp(negG.getY())).to.equal(0);
    });

    it('P.DECODE.HYBRID - decode 0x06 / 0x07 hybrid formats', function () {
      const G = Point.getG();
      // G has even Y -> 0x06 (hybrid-even)
      // Construct a 0x06-prefixed uncompressed buffer
      const G_comp_hex = G.encode('hex', true);
      const G_uncompr_hex = G.encode('hex');
      const uncomprBuf = Buffer.from(G_uncompr_hex, 'hex');
      // Replace 0x04 with 0x06
      const hybrid_even = Buffer.from(uncomprBuf);
      hybrid_even[0] = 0x06;
      const decodedEven = Curve.decodePoint(hybrid_even);
      expect(decodedEven.getX().cmp(G.getX())).to.equal(0);
      expect(decodedEven.getY().cmp(G.getY())).to.equal(0);

      // 0x07 for odd Y (G.neg())
      const negG = G.neg();
      const negUncomprBuf = Buffer.from(negG.encode('hex'), 'hex');
      const hybrid_odd = Buffer.from(negUncomprBuf);
      hybrid_odd[0] = 0x07;
      const decodedOdd = Curve.decodePoint(hybrid_odd);
      expect(decodedOdd.getX().cmp(G.getX())).to.equal(0);
      expect(decodedOdd.getY().cmp(negG.getY())).to.equal(0);
    });

    it('P.DECODE.INVALID - invalid format throws "Unknown point format"', function () {
      // No prefix
      expect(() => Curve.decodePoint(Buffer.from('04', 'hex'))).to.throw('Unknown point format');
      // 0x01 is not a valid format
      expect(() => Curve.decodePoint(Buffer.from('01' + SECP_G_X, 'hex'))).to.throw('Unknown point format');
      // 0x05 is not a valid format
      expect(() => Curve.decodePoint(Buffer.from('05' + SECP_G_X, 'hex'))).to.throw('Unknown point format');
    });

    it('P.GETX - getX() returns BN (not in red form)', function () {
      const G = Point.getG();
      const x = G.getX();
      expect(BN.isBN(x)).to.be.true;
      expect(x.red).to.be.null;
    });

    it('P.GETY - getY() returns BN (not in red form)', function () {
      const G = Point.getG();
      const y = G.getY();
      expect(BN.isBN(y)).to.be.true;
      expect(y.red).to.be.null;
    });

    it('P.GETX.TO_BUFFER - getX().toBuffer({size: 32}) produces 32-byte buffer', function () {
      const G = Point.getG();
      const buf = G.getX().toBuffer({ size: 32 });
      expect(Buffer.isBuffer(buf)).to.be.true;
      expect(buf.length).to.equal(32);
      expect(buf.toString('hex')).to.equal(SECP_G_X);
    });

    it('P.GETY.TO_BUFFER - getY().toBuffer({size: 32}) produces 32-byte buffer', function () {
      const G = Point.getG();
      const buf = G.getY().toBuffer({ size: 32 });
      expect(Buffer.isBuffer(buf)).to.be.true;
      expect(buf.length).to.equal(32);
      expect(buf.toString('hex')).to.equal(SECP_G_Y);
    });
  });

  // -----------------------------------------------------------------
  // 2.6 LiftX
  // -----------------------------------------------------------------
  describe('2.6 LiftX', function () {

    it('P.LIFTX.IDENTITY - P.liftX() of a known point recovers that point', function () {
      const G = Point.getG();
      const lifted = G.liftX();
      // liftX() calls Point.fromX(false, pointX) which selects the even-y root.
      // G has even Y, so it should recover G itself.
      expect(lifted.eq(G)).to.be.true;
    });

    it('P.LIFTX.YELLOW - lifted x recovers correct y (even by default)', function () {
      const G = Point.getG();
      const G2 = G.mul('2'); // 2G
      const lifted2 = G2.liftX();
      // liftX selects the even-y root. For 2G:
      // If 2G has even Y, lifted should equal 2G.
      // If 2G has odd Y, lifted should equal 2G.neg().
      if (G2.getY().isOdd()) {
        expect(lifted2.eq(G2.neg())).to.be.true;
      } else {
        expect(lifted2.eq(G2)).to.be.true;
      }
      // In both cases, the recovered Y is even
      expect(lifted2.getY().isOdd()).to.be.false;
    });
  });
});
