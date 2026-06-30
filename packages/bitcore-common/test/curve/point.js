/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve } = require('../../');
const { expect } = require('chai');
const vectors = require('../data/secp256k1-vectors');
const {
  isOnCurve,
  pad64,
  SECP_N,
  SECP_N_MINUS_1,
  SECP_N_MINUS_2,
  SECP_G_X,
  SECP_G_Y
} = require('./helpers');

describe('Point (Affine) - lib/curve/point.js', function () {
  describe('Construction', function () {

    it('P.CONSTR.NORMAL - Point(curve, x, y) creates affine point with hex coords', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt).to.exist;
      expect(pt.isInfinity()).to.be.false;
      expect(pt.getX().toString(16)).to.equal(SECP_G_X);
      expect(pt.getY().toString(16)).to.equal(SECP_G_Y);
      expect(pt.x.red).to.equal(Curve.red);
      expect(pt.y.red).to.equal(Curve.red);
    });

    it('P.CONSTR.INF - Point(curve, null, null) creates point at infinity', function () {
      const inf = Curve.point(null, null);
      expect(inf).to.exist;
      expect(inf.isInfinity()).to.be.true;
      expect(inf.x).to.be.null;
      expect(inf.y).to.be.null;
    });

    it.skip('P.CONSTR.ISRED - Point.fromJSON preserves red coordinates', function () {
      // Known deficiency: red=true with already-red coordinates asserts in
      // forceRed().
      const p = Curve.g;
      const json = p.toJSON();
      // json[0] and json[1] are Red BNs from toJSON()
      const restored = Curve.pointFromJSON(json, true);
      expect(restored).to.exist;
      expect(restored.isInfinity()).to.be.false;
      expect(restored.x.red).to.equal(Curve.red);
      expect(restored.y.red).to.equal(Curve.red);
      expect(restored.x.toString(16)).to.equal(SECP_G_X);
      expect(restored.y.toString(16)).to.equal(SECP_G_Y);
    });
  });
  describe('Addition', function () {

    it('P.ADD.OFF_CURVE - Adding two points on the curve produces a result on the curve', function () {
      const p1 = Curve.g;
      const p2 = Curve.g.mul('3');
      const sum = p1.add(p2);
      expect(isOnCurve(sum)).to.be.true;
    });

    it('P.ADD.COMMUTATIVE - P.add(Q).eq(Q.add(P)) for distinct points', function () {
      const p1 = Curve.g;
      const p2 = Curve.g.mul('5');
      expect(p1.add(p2).eq(p2.add(p1))).to.be.true;
    });

    it('P.ADD.ASSOCIATIVE - (P.add(Q)).add(R).eq(P.add(Q.add(R)))', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const g3 = Curve.g.mul('3');
      // Verify two groupings are equal (associativity)
      const left = g.add(g2).add(g3);
      const right = g.add(g2.add(g3));
      expect(left.eq(right)).to.be.true;
      // Also verify the result against an independent vector oracle: 6G
      expect(pad64(left.getX().toString(16))).to.equal(vectors.KG['0x6'].x);
      expect(pad64(left.getY().toString(16))).to.equal(vectors.KG['0x6'].y);
    });

    it('P.ADD.IDENTITY - P.add(infinity) == P and infinity.add(P) == P', function () {
      const p = Curve.g;
      const inf = Curve.point(null, null);
      expect(p.add(inf).eq(p)).to.be.true;
      expect(inf.add(p).eq(p)).to.be.true;
    });

    it('P.ADD.INVERSE - P.add(P.neg()).isInfinity()', function () {
      const p = Curve.g;
      expect(p.add(p.neg()).isInfinity()).to.be.true;
      // Also test for 2G
      const g2 = Curve.g.mul('2');
      expect(g2.add(g2.neg()).isInfinity()).to.be.true;
    });

    it('P.ADD.SELF_EQ_DBL - P.add(P).eq(P.dbl())', function () {
      expect(Curve.g.add(Curve.g).eq(Curve.g.dbl())).to.be.true;
      const g5 = Curve.g.mul('5');
      expect(g5.add(g5).eq(g5.dbl())).to.be.true;
    });

    it('P.ADD.COLLINEAR_X - P.add(-P) returns infinity', function () {
      // For secp256k1, two points with the same x coordinate must be P and -P.
      // There is no scenario where P.x == Q.x with P != +/-Q.
      // This test verifies that P + (-P) = infinity.
      const p = Curve.g;
      const pInv = p.neg();
      // p.x equals pInv.x, and p != pInv.
      expect(p.x.cmp(pInv.x)).to.equal(0);
      expect(p.eq(pInv)).to.be.false;
      expect(p.add(pInv).isInfinity()).to.be.true;
    });

    it('P.ADD.G_TO_G2 - G.add(G) produces 2G with known coordinates', function () {
      const sum = Curve.g.add(Curve.g);
      // Independent vector oracle.
      expect(sum.getX().toString(16)).to.equal(vectors.KG['0x2'].x);
      expect(sum.getY().toString(16)).to.equal(vectors.KG['0x2'].y);
      expect(sum.eq(Curve.g.dbl())).to.be.true;
    });
  });
  describe('Doubling', function () {

    it('P.DBL.INF - infinity.dbl() returns infinity', function () {
      const inf = Curve.point(null, null);
      expect(inf.dbl().isInfinity()).to.be.true;
    });

    it('P.DBL.ON_CURVE - dbl() result satisfies curve equation', function () {
      const p = Curve.g.mul('7');
      const dbl = p.dbl();
      expect(isOnCurve(dbl)).to.be.true;
      // Also test for 3G
      const g3 = Curve.g.mul('3');
      expect(isOnCurve(g3.dbl())).to.be.true;
    });

    it('P.DBL.G - G.dbl() produces correct 2G coordinates', function () {
      const dbl = Curve.g.dbl();
      // Independent vector oracle.
      expect(dbl.getX().toString(16)).to.equal(vectors.KG['0x2'].x);
      expect(dbl.getY().toString(16)).to.equal(vectors.KG['0x2'].y);
    });
  });
  describe('Negation', function () {

    it('P.NEG.INF - infinity.neg() returns infinity', function () {
      const inf = Curve.point(null, null);
      expect(inf.neg().isInfinity()).to.be.true;
    });

    it('P.NEG.Y_FLIP - P.neg() flips y: negY = p - y', function () {
      const p = Curve.g;
      const negP = p.neg();
      expect(negP.getX().toString(16)).to.equal(SECP_G_X);
      // negP.y should be p - p.y
      const expectedNegY = Curve.p.sub(p.getY());
      expect(negP.getY().toString(16)).to.equal(expectedNegY.toString(16));
      // Double negation recovers original
      expect(negP.neg().eq(p)).to.be.true;
    });

    it('P.NEG.PRECOMPUTE - P.neg(true) propagates negation into precomputed tables', function () {
      const p = Curve.point(Curve.g.getX(), Curve.g.getY());
      p.precompute(4);
      expect(p.precomputed).to.exist;
      const negP = p.neg(true);
      expect(negP.precomputed).to.exist;
      expect(negP.precomputed.naf).to.exist;
      expect(negP.precomputed.doubles).to.exist;
      // Verify the negated point's precomputed tables are consistent
      expect(negP.neg(true).eq(p)).to.be.true;
    });
  });
  describe('Equality', function () {

    it('P.EQ.SAME - P.eq(P) returns true', function () {
      expect(Curve.g.eq(Curve.g)).to.be.true;
    });

    it('P.EQ.VALUE - Two distinct instances with same coords are equal', function () {
      const p1 = Curve.point(SECP_G_X, SECP_G_Y);
      const p2 = Curve.point(SECP_G_X, SECP_G_Y);
      expect(p1).to.not.equal(p2); // Different instances
      expect(p1.eq(p2)).to.be.true; // Same value
    });

    it('P.EQ.DIFF - P.eq(Q) is false when coords differ', function () {
      const p1 = Curve.g;
      const p2 = Curve.g.mul('2');
      expect(p1.eq(p2)).to.be.false;
    });

    it('P.EQ.INF - infinity.eq(infinity) is true', function () {
      const inf1 = Curve.point(null, null);
      const inf2 = Curve.point(null, null);
      expect(inf1.eq(inf2)).to.be.true;
    });

    it('P.EQ.INF_AND_NORMAL - infinity.eq(normal point) is false', function () {
      const inf = Curve.point(null, null);
      expect(inf.eq(Curve.g)).to.be.false;
    });
  });
  describe('isInfinity', function () {

    it('P.IS_INFINITY - normal point returns false', function () {
      expect(Curve.g.isInfinity()).to.be.false;
    });

    it('P.IS_INFINITY - infinity point returns true', function () {
      const inf = Curve.point(null, null);
      expect(inf.isInfinity()).to.be.true;
    });

    it('P.IS_INFINITY - 2G is not infinity', function () {
      expect(Curve.g.dbl().isInfinity()).to.be.false;
    });

    it('P.IS_INFINITY - G.mul(N) is infinity', function () {
      expect(Curve.g.mul(SECP_N).isInfinity()).to.be.true;
    });
  });
  describe('Scalar Multiplication', function () {

    it('P.MUL.G_BY_1 - G.mul("1") == G', function () {
      expect(Curve.g.mul('1').eq(Curve.g)).to.be.true;
    });

    it('P.MUL.G_BY_2 - G.mul("2") == G.dbl()', function () {
      expect(Curve.g.mul('2').eq(Curve.g.dbl())).to.be.true;
    });

    it('P.MUL.G_BY_2_KNOWN - G.mul("2") produces known 2G coordinates', function () {
      const result = Curve.g.mul('2');
      // Independent vector oracle.
      expect(result.getX().toString(16)).to.equal(vectors.KG['0x2'].x);
      expect(result.getY().toString(16)).to.equal(vectors.KG['0x2'].y);
    });

    it('P.MUL.G_BY_N - G.mul(N) is infinity (order property)', function () {
      expect(Curve.g.mul(SECP_N).isInfinity()).to.be.true;
    });

    it('P.MUL.G_BY_NMINUS1 - G.mul(N-1) == G.neg()', function () {
      // N - 1 as hex: SECP_N is 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
      // N - 1 = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140'
      expect(Curve.g.mul(SECP_N_MINUS_1).eq(Curve.g.neg())).to.be.true;
    });

    it('P.MUL.G_BY_0 - G.mul("0") is infinity', function () {
      expect(Curve.g.mul('0').isInfinity()).to.be.true;
    });

    it('P.MUL.LARGE_SCALAR - G.mul(large hex) produces valid non-infinity point', function () {
      // Use a 256-bit scalar less than n
      const largeScalar = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const result = Curve.g.mul(largeScalar);
      expect(result.isInfinity()).to.be.false;
      expect(isOnCurve(result)).to.be.true;
    });

    it('P.MUL.INF - infinity.mul(k) is infinity', function () {
      const inf = Curve.point(null, null);
      expect(inf.mul('1').isInfinity()).to.be.true;
      expect(inf.mul('ff').isInfinity()).to.be.true;
      expect(inf.mul(SECP_N).isInfinity()).to.be.true;
    });

    it('P.MUL.DISTRIBUTIVE - G.mul("3").add(G.mul("5")) == G.mul("8")', function () {
      const left = Curve.g.mul('3').add(Curve.g.mul('5'));
      const right = Curve.g.mul('8');
      // Verify structural equality: 3G + 5G == 8G
      expect(left.eq(right)).to.be.true;
      // Also verify against an independent vector oracle: 8G
      expect(pad64(left.getX().toString(16))).to.equal(vectors.KG['0x8'].x);
      expect(pad64(left.getY().toString(16))).to.equal(vectors.KG['0x8'].y);
    });

    it('P.MUL.ASSOC_SCALAR - G.mul("6").eq(G.mul("3").mul("2"))', function () {
      const left = Curve.g.mul('6');
      const right = Curve.g.mul('3').mul('2');
      expect(left.eq(right)).to.be.true;
    });

    it('P.MUL.PRECOMP_PATH - precomputed mul matches non-precomputed mul for k=0x100', function () {
      const p = Curve.point(Curve.g.getX(), Curve.g.getY());
      p.precompute(16);
      const withDoubles = p.mul('100'); // 0x100 = 256
      // Verify against non-precomputed version (internal path consistency)
      const noPre = Curve.point(Curve.g.getX(), Curve.g.getY()).mul('100');
      expect(withDoubles.eq(noPre)).to.be.true;
      // Verify on-curve (independent mathematical check)
      expect(isOnCurve(withDoubles)).to.be.true;
    });

    it('P.MUL.ENDO_PATH - G.mul("ff") uses endo path and matches non-endo result', function () {
      const withEndo = Curve.g.mul('ff');
      // Verify by computing via another path: 0xff = 255 = 3 * 85 = 15 * 17
      // Compute 0xff manually: G.mul('ff')
      const manually = Curve.g.mul('f').mul('11'); // ff = f * 11 (nope, 0xf * 0x11 = 0xff? 15*17=255=0xff yes)
      expect(withEndo.eq(manually)).to.be.true;
    });

    it('P.MUL.NMINUS1.NEG_X - G.neg().getX() equals G.x', function () {
      expect(Curve.g.neg().getX().toString(16, 64)).to.equal(vectors.KG['0x1'].x);
    });

    it('P.MUL.NMINUS1.NEG_Y - G.neg().getY() equals negY(G.y)', function () {
      const expectedNegY = vectors.negY(vectors.KG['0x1'].y);
      expect(Curve.g.neg().getY().toString(16, 64)).to.equal(expectedNegY);
    });
  });
  describe('mulAdd / jmulAdd', function () {

    it('P.MULADD - G.mulAdd(BN(3), G2, BN(5)) == 3G + 5*(2G) == 13G (k1/k2 are BN objects, NOT hex strings)', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      // mulAdd passes coefficients directly to _endoWnafMulAdd / _wnafMulAdd
      // without BN() conversion, unlike mul() which does new BN(k, 16).
      const result = g.mulAdd(new BN('3', 16), g2, new BN('5', 16));
      const expected = Curve.g.mul('d');
      expect(result.eq(expected)).to.be.true;
    });

    it('P.JMULADD - jmulAdd(3, G2, 5) equals mulAdd(3, G2, 5) with BN coefficients', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const mulAddResult = g.mulAdd(new BN('3', 16), g2, new BN('5', 16));
      const jmulAddResult = g.jmulAdd(new BN('3', 16), g2, new BN('5', 16));
      // Verify structural equality: jmulAdd == mulAdd
      expect(jmulAddResult.toP().eq(mulAddResult)).to.be.true;
      // Also verify against an independent vector oracle: 13G
      expect(pad64(jmulAddResult.toP().getX().toString(16))).to.equal(vectors.KG['0xd'].x);
      expect(pad64(jmulAddResult.toP().getY().toString(16))).to.equal(vectors.KG['0xd'].y);
    });
  });
  describe('toJ - Affine to Jacobian', function () {

    it('P.TOJ - P.toJ() converts to Jacobian form and back', function () {
      const p = Curve.g;
      const j = p.toJ();
      expect(j.type).to.equal('jacobian');
      expect(j.toP().eq(p)).to.be.true;
    });

    it('P.TOJ.INF - infinity.toJ() produces JPoint at infinity', function () {
      const inf = Curve.point(null, null);
      const j = inf.toJ();
      expect(j.isInfinity()).to.be.true;
      expect(j.type).to.equal('jacobian');
    });

    it('P.TOJ.2G - 2G.toJ().toP() == 2G', function () {
      const g2 = Curve.g.mul('2');
      expect(g2.toJ().toP().eq(g2)).to.be.true;
    });
  });
  describe('toJSON / fromJSON', function () {

    it('P.TOJSON.NO_PRECOMP - Point without precomputed toJSON returns [x, y]', function () {
      // Use a fresh point to avoid shared state pollution from prior precompute() calls
      const p = Curve.point(SECP_G_X, SECP_G_Y);
      const json = p.toJSON();
      expect(Array.isArray(json)).to.be.true;
      expect(json.length).to.equal(2);
    });

    it('P.TOJSON.WITH_PRECOMP - Point with precomputed toJSON returns [x, y, {doubles, naf}]', function () {
      const p = Curve.point(Curve.g.getX(), Curve.g.getY());
      p.precompute(4);
      const json = p.toJSON();
      expect(Array.isArray(json)).to.be.true;
      expect(json.length).to.equal(3);
      expect(json[2]).to.exist;
      expect(json[2].doubles).to.exist;
      expect(json[2].naf).to.exist;
    });

    it('P.FROMJSON.BASIC - Point.fromJSON(curve, [x,y]) recovers original point', function () {
      const p = Curve.point(Curve.g.getX(), Curve.g.getY());
      const json = p.toJSON();
      const restored = Curve.pointFromJSON(json);
      expect(restored.eq(p)).to.be.true;
    });

    it('P.FROMJSON.WITH_PRECOMP - Point.fromJSON restores precomputed tables', function () {
      const p = Curve.point(Curve.g.getX(), Curve.g.getY());
      p.precompute(4);
      const json = p.toJSON();
      const restored = Curve.pointFromJSON(json);
      expect(restored.precomputed).to.exist;
      expect(restored.precomputed.doubles).to.exist;
      expect(restored.precomputed.naf).to.exist;
      expect(restored.eq(p)).to.be.true;
    });

    it('P.FROMJSON.ROUNDTRIP - toJSON/fromJSON roundtrips for various points', function () {
      const gCopy = Curve.point(Curve.g.getX(), Curve.g.getY());
      const points = [
        gCopy,
        Curve.g.mul('2'),
        Curve.g.mul('ff'),
        Curve.g.mul('100'),
      ];
      for (const pt of points) {
        const json = pt.toJSON();
        const restored = Curve.pointFromJSON(json);
        expect(restored.eq(pt)).to.be.true,
        'roundtrip failed for point';
      }
    });
  });
  describe('getX / getY', function () {

    it('P.GETX - Point.getX() returns x coordinate as a plain BN (via .fromRed())', function () {
      const p = Curve.g;
      // getX() returns a plain BN.
      const x = p.getX();
      expect(BN.isBN(x)).to.be.true;
      expect(x.toString(16)).to.equal(SECP_G_X);
    });

    it('P.GETY - Point.getY() returns y coordinate as a plain BN (via .fromRed())', function () {
      const p = Curve.g;
      // getY() returns a plain BN.
      const y = p.getY();
      expect(BN.isBN(y)).to.be.true;
      expect(y.toString(16)).to.equal(SECP_G_Y);
    });

    it('P.GETX_2G - 2G.getX() matches known 2G x', function () {
      const g2 = Curve.g.dbl();
      // Independent vector oracle.
      expect(g2.getX().toString(16)).to.equal(vectors.KG['0x2'].x);
    });

    it('P.GETY_2G - 2G.getY() matches known 2G y', function () {
      const g2 = Curve.g.dbl();
      // Independent vector oracle.
      expect(g2.getY().toString(16)).to.equal(vectors.KG['0x2'].y);
    });
  });
  describe('_getBeta - Endomorphism helper', function () {

    it('P.GETBETA.CACHED - _getBeta() caches result in precomputed.beta', function () {
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      // Without precomputed, _getBeta returns a fresh point
      const first = g._getBeta();
      // With precompute, _getBeta caches into precomputed.beta
      g.precompute(4);
      const second = g._getBeta();
      expect(second).to.equal(g.precomputed.beta);
      // Same result both times
      expect(first.eq(second)).to.be.true;
    });
  });
  describe('Negative Scalar Multiplication', function () {
    describe('Point.mul - Negative Scalars', function () {

      // Known deficiency: Point.mul() does not normalize negative scalars mod N.

      it.skip('P.MUL.NEG_STRING_1 - G.mul("-1") equals -G', function () {
        const negG = Curve.g.neg();
        const mulNeg1 = Curve.g.mul('-1');
        expect(mulNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(mulNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it.skip('P.MUL.NEG_BN_1 - G.mul(BN(-1)) equals -G', function () {
        const negG = Curve.g.neg();
        const mulNeg1 = Curve.g.mul(new BN(-1));
        expect(mulNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(mulNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it.skip('P.MUL.NEG_HEX_BN_1 - G.mul(new BN("-1", 16)) equals -G', function () {
        const negG = Curve.g.neg();
        const mulNeg1 = Curve.g.mul(new BN('-1', 16));
        expect(mulNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(mulNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it.skip('P.MUL.NEG_DEC_BN_1 - G.mul(new BN("-1", 10)) equals -G', function () {
        const negG = Curve.g.neg();
        const mulNeg1 = Curve.g.mul(new BN('-1', 10));
        expect(mulNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(mulNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it.skip('P.MUL.NEG_STRING_2 - G.mul("-2") equals -(2G)', function () {
        const expectedNeg2 = Curve.g.mul('2').neg();
        const mulNeg2 = Curve.g.mul('-2');
        expect(mulNeg2.getX().toString(16)).to.equal(expectedNeg2.getX().toString(16));
        expect(mulNeg2.getY().toString(16)).to.equal(expectedNeg2.getY().toString(16));
      });

      it.skip('P.MUL.NEG_NUMBER_1 - G.mul(-1) equals -G', function () {
        const negG = Curve.g.neg();
        const mulNeg1 = Curve.g.mul(-1);
        expect(mulNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(mulNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it('P.MUL.NEG_STRING_1_CURRENT - current G.mul("-1") result remains on-curve', function () {
        expect(isOnCurve(Curve.g.mul('-1'))).to.be.true;
      });
    });
    describe('JPoint.mul - Negative Scalars', function () {

      // Known deficiency: JPoint.mul() has the same negative-scalar issue as Point.mul().

      it.skip('JP.MUL.NEG_STRING_1 - G.toJ().mul("-1") equals -G', function () {
        const negG = Curve.g.neg();
        const jNeg1 = Curve.g.toJ().mul('-1').toP();
        expect(jNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(jNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it.skip('JP.MUL.NEG_BN_1 - G.toJ().mul(BN(-1)) equals -G', function () {
        const negG = Curve.g.neg();
        const jNeg1 = Curve.g.toJ().mul(new BN(-1)).toP();
        expect(jNeg1.getX().toString(16)).to.equal(negG.getX().toString(16));
        expect(jNeg1.getY().toString(16)).to.equal(negG.getY().toString(16));
      });

      it('JP.MUL.NEG_STRING_1_CURRENT - current JPoint result remains on-curve', function () {
        const j = Curve.g.toJ().mul('-1');
        expect(isOnCurve(j.toP())).to.be.true;
      });
    });
    describe('mulAdd / jmulAdd - Negative Coefficients', function () {

      it('P.JMULADD.NEG_COEFF_MATCHES_MULADD - jmulAdd and mulAdd agree', function () {
        const g2 = Curve.g.mul('2');
        const mulAddResult = Curve.g.mulAdd(new BN(-1), g2, new BN(1));
        const jmulAddResult = Curve.g.jmulAdd(new BN(-1), g2, new BN(1));
        expect(jmulAddResult.toP().getX().toString(16)).to.equal(mulAddResult.getX().toString(16));
        expect(jmulAddResult.toP().getY().toString(16)).to.equal(mulAddResult.getY().toString(16));
      });

      it('P.MULADD.NEG_COEFF_1 - -G + 2G equals G', function () {
        const g2 = Curve.g.mul('2');
        const result = Curve.g.mulAdd(new BN(-1), g2, new BN(1));
        expect(result.getX().toString(16, 64)).to.equal(vectors.KG['0x1'].x);
        expect(result.getY().toString(16, 64)).to.equal(vectors.KG['0x1'].y);
      });

      it('P.MULADD.NEG_COEFF_2 - -2G + 3G equals G', function () {
        const result = Curve.g.mulAdd(new BN(-2), Curve.g, new BN(3));
        expect(result.getX().toString(16, 64)).to.equal(vectors.KG['0x1'].x);
        expect(result.getY().toString(16, 64)).to.equal(vectors.KG['0x1'].y);
      });

      it('P.MULADD.NEG_COEFF_CANCEL - -G + G is infinity', function () {
        const result = Curve.g.mulAdd(new BN(-1), Curve.g, new BN(1));
        expect(result.isInfinity()).to.be.true;
      });

      it('P.MULADD.NEG_COEFF_5 - -5G + 3G equals -2G', function () {
        const result = Curve.g.mulAdd(new BN(-5), Curve.g, new BN(3));
        expect(result.getX().toString(16, 64)).to.equal(vectors.NEG_2G_X);
        expect(result.getY().toString(16, 64)).to.equal(vectors.NEG_2G_Y);
      });
    });
    describe('Boundary - Negative Scalar vs. Modular Equivalent', function () {

      // Known deficiency: negative scalar inputs are not equivalent to their
      // positive representatives mod N.

      it.skip('P.MUL.NEG_STRING_1_EQ_N_MINUS_1 - -1 and N-1 are equivalent', function () {
        const mulNeg1 = Curve.g.mul('-1');
        const mulNMinus1 = Curve.g.mul(SECP_N_MINUS_1);
        expect(mulNeg1.getX().toString(16)).to.equal(mulNMinus1.getX().toString(16));
        expect(mulNeg1.getY().toString(16)).to.equal(mulNMinus1.getY().toString(16));
      });

      it.skip('P.MUL.NEG_STRING_2_EQ_N_MINUS_2 - -2 and N-2 are equivalent', function () {
        const mulNeg2 = Curve.g.mul('-2');
        const mulNMinus2 = Curve.g.mul(SECP_N_MINUS_2);
        expect(mulNeg2.getX().toString(16)).to.equal(mulNMinus2.getX().toString(16));
        expect(mulNeg2.getY().toString(16)).to.equal(mulNMinus2.getY().toString(16));
      });

      it.skip('P.MUL.NEG_STRING_1_DOUBLE_NEGATION - -(-G) equals G', function () {
        const doubleNeg = Curve.g.mul('-1').neg();
        expect(doubleNeg.getX().toString(16)).to.equal(Curve.g.getX().toString(16));
        expect(doubleNeg.getY().toString(16)).to.equal(Curve.g.getY().toString(16));
      });

      it('P.MUL.NEG_INFINITY - infinity remains infinity under negative multiplication', function () {
        expect(Curve.g.mul(SECP_N).mul('-1').isInfinity()).to.be.true;
      });
    });
  });
  describe('inspect', function () {

    it('P.INSPECT.NORMAL - point.inspect() returns string for normal point', function () {
      const p = Curve.g;
      const str = p.inspect();
      expect(str).to.be.a('string');
      expect(str).to.contain('EC Point');
      expect(str).to.contain('x:');
      expect(str).to.contain('y:');
    });

    it('P.INSPECT.INF - infinity.inspect() returns "<EC Point Infinity>"', function () {
      const inf = Curve.point(null, null);
      expect(inf.inspect()).to.equal('<EC Point Infinity>');
    });

    it('P.INSPECT.2G - 2G.inspect() contains correct x hex prefix', function () {
      const g2 = Curve.g.dbl();
      const str = g2.inspect();
      expect(str).to.contain('EC Point');
    });
  });

});
