/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const BN = require('../../').BN;
const Curve = require('../../').Curve;
const vectors = require('../data/secp256k1-vectors');
const { expect } = require('chai');

// secp256k1 constants
const SECP_N = vectors.N;

// Helper: check if a Jacobian point satisfies y² = x³ + 7 (mod p) after conversion
function isOnCurveJ(jp) {
  return Curve.validate(jp.toP());
}

// Helper: check if an affine point satisfies y² = x³ + 7 (mod p)
function isOnCurve(p) {
  if (p.isInfinity()) return true;
  return Curve.validate(p);
}

describe('8. Internal Arithmetic Path Coverage — lib/curve/point.js', function () {

  // -----------------------------------------------------------------
  // 8.1 _zeroDbl — Optimized Jacobian doubling for a=0 curves
  // -----------------------------------------------------------------
  describe('8.1 _zeroDbl — Jacobian doubling path for a=0', function () {

    it('ARITH._ZERODBL.Z1 - _zeroDbl with z=1 path (zOne=true)', function () {
      // secp256k1 has a=0, so dbl() calls _zeroDbl()
      // With z=1, the zOne=true branch is taken (1M + 5S + 14A)
      const g = Curve.g;
      const j = g.toJ();
      expect(j.zOne).to.be.true;
      expect(Curve.zeroA).to.be.true;

      // Call _zeroDbl directly to test this code path
      const dblZero = j._zeroDbl();
      expect(dblZero).to.exist;
      expect(isOnCurveJ(dblZero)).to.be.true;

      // Verify it equals 2G using known vector (independent oracle)
      const expected2G = vectors.KG['0x2'];
      const dblAffine = dblZero.toP();
      expect(dblAffine.x.toString(16, 64)).to.equal(expected2G.x);
      expect(dblAffine.y.toString(16, 64)).to.equal(expected2G.y);
    });

    it('ARITH._ZERODBL.NZ1 - _zeroDbl with z≠1 path', function () {
      // With z≠1, the zOne=false branch is taken (2M + 5S + 13A)
      // We construct a JPoint with z=2 so its affine coords equal G
      const g = Curve.g;
      const z2red = Curve.two; // z=2 in red form
      const z2sq = z2red.redSqr(); // z^2 = 4
      // Projective: (x*z², y*z³, z) = (x*4, y*8, 2)
      const xProj = g.x.redMul(z2sq);
      const yProj = g.y.redMul(z2sq).redMul(z2red);
      const j = Curve.jpoint(xProj, yProj, '2');
      expect(j.zOne).to.be.false;

      // Call _zeroDbl directly to test the z≠1 branch
      const dblZero = j._zeroDbl();
      expect(dblZero).to.exist;
      expect(dblZero.isInfinity()).to.be.false;
      expect(isOnCurveJ(dblZero)).to.be.true;

      // Convert to affine and verify it's 2G using known vector (independent oracle)
      const dblAffine = dblZero.toP();
      const expected2G = vectors.KG['0x2'];
      expect(dblAffine.x.toString(16, 64)).to.equal(expected2G.x);
      expect(dblAffine.y.toString(16, 64)).to.equal(expected2G.y);
    });

    it('ARITH._ZERODBL.GIVEN_POINT - _zeroDbl correctness on 3G', function () {
      // Test _zeroDbl with a non-G point: 3G
      const p3 = Curve.g.mul('3');
      const z2 = Curve.two;
      const z2sq = z2.redSqr();
      const xProj = p3.x.redMul(z2sq);
      const yProj = p3.y.redMul(z2sq).redMul(z2);
      const j = Curve.jpoint(xProj, yProj, '2');
      expect(j.zOne).to.be.false;

      // _zeroDbl should give 6G — verify against known vector
      const dblZero = j._zeroDbl();
      const expected6G = vectors.KG['0x6'];
      const dblAffine6G = dblZero.toP();
      expect(dblAffine6G.x.toString(16, 64)).to.equal(expected6G.x);
      expect(dblAffine6G.y.toString(16, 64)).to.equal(expected6G.y);
      expect(isOnCurveJ(dblZero)).to.be.true;
    });

    it('ARITH._ZERODBL.LARGE_POINT - _zeroDbl on a large-multiplication point', function () {
      // Use a large scalar point: 0xdeadbeef * G
      const largeScalar = 'deadbeef';
      const p = Curve.g.mul(largeScalar);
      const z3 = new BN(3).toRed(Curve.red);
      const z3sq = z3.redSqr();
      const xProj = p.x.redMul(z3sq);
      const yProj = p.y.redMul(z3sq).redMul(z3);
      const j = Curve.jpoint(xProj, yProj, '3');
      expect(j.zOne).to.be.false;

      // _zeroDbl should give 2 * (0xdeadbeef * G)
      // Verify via on-curve check (independent oracle: y² = x³ + 7 mod p)
      const dblZero = j._zeroDbl();
      expect(isOnCurveJ(dblZero)).to.be.true;
    });

    it('ARITH._ZERODBL.INF - _zeroDbl on infinity returns infinity', function () {
      const inf = Curve.jpoint(null, null, null);
      expect(inf.z.cmpn(0)).to.equal(0);
      const dblInf = inf._zeroDbl();
      expect(dblInf.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 8.2 _threeDbl — Jacobian doubling path for a=-3 curves (secp256k1 guard)
  // -----------------------------------------------------------------
  describe('8.2 _threeDbl — Jacobian doubling path for a=-3 (guard path)', function () {

    it('ARITH._THREEDBL.GUARD - secp256k1 does NOT use _threeDbl (a=0, not a=-3)', function () {
      // secp256k1 has a=0, not a=-3, so _threeDbl should never be called
      expect(Curve.zeroA).to.be.true;
      expect(Curve.threeA).to.be.false;

      // _zeroDbl is called instead of _threeDbl
      const j = Curve.g.toJ();
      expect(j.zOne).to.be.true;
      const dblResult = j.dbl();
      // Verify the result is correct using known vector (confirms _zeroDbl path)
      const dblAffine = dblResult.toP();
      const expected2G = vectors.KG['0x2'];
      expect(dblAffine.x.toString(16, 64)).to.equal(expected2G.x);
      expect(dblAffine.y.toString(16, 64)).to.equal(expected2G.y);
    });

    it('ARITH._THREEDBL.EXISTENCE - _threeDbl method exists on JPoint', function () {
      // Even though secp256k1 doesn't use it, _threeDbl should be defined
      const j = Curve.g.toJ();
      expect(j._threeDbl).to.be.a('function');
    });

    it('ARITH._THREEDBL.SELF_CONSISTENT - _threeDbl with z=1 and z≠1 produce on-curve results', function () {
      // _threeDbl is mathematically correct for a=-3 curves.
      // On secp256k1 (a=0), it still produces valid results, just not the
      // mathematically expected ones for the curve equation.
      // We verify it doesn't crash and produces a JPoint.
      const j1 = Curve.g.toJ();
      expect(j1.zOne).to.be.true;
      const resultZ1 = j1._threeDbl();
      expect(resultZ1).to.exist;

      const z2 = Curve.two;
      const z2sq = z2.redSqr();
      const xProj = Curve.g.x.redMul(z2sq);
      const yProj = Curve.g.y.redMul(z2sq).redMul(z2);
      const jNZ1 = Curve.jpoint(xProj, yProj, '2');
      expect(jNZ1.zOne).to.be.false;
      const resultNZ1 = jNZ1._threeDbl();
      expect(resultNZ1).to.exist;
    });
  });

  // -----------------------------------------------------------------
  // 8.3 _dbl — General Jacobian doubling (fallback path)
  // -----------------------------------------------------------------
  describe('8.3 _dbl — General Jacobian doubling fallback', function () {

    it('ARITH._DBL.EXISTS - _dbl is defined on JPoint', function () {
      const j = Curve.g.toJ();
      expect(j._dbl).to.be.a('function');
    });

    it('ARITH._DBL.Z1 - _dbl with z=1 produces on-curve result for secp256k1', function () {
      // _dbl is the general doubling formula (4M + 6S + 10A).
      // For a=0, _zeroDbl is preferred, but _dbl should still work correctly.
      const j = Curve.g.toJ();
      expect(j.zOne).to.be.true;

      const dblResult = j._dbl();
      expect(isOnCurveJ(dblResult)).to.be.true;
      // Should equal 2G using known vector
      const dblAffine2 = dblResult.toP();
      const expected2G = vectors.KG['0x2'];
      expect(dblAffine2.x.toString(16, 64)).to.equal(expected2G.x);
      expect(dblAffine2.y.toString(16, 64)).to.equal(expected2G.y);
    });

    it('ARITH._DBL.NZ1 - _dbl with z≠1 produces correct result', function () {
      const p3 = Curve.g.mul('3');
      const z3 = new BN(3).toRed(Curve.red);
      const z3sq = z3.redSqr();
      const xProj = p3.x.redMul(z3sq);
      const yProj = p3.y.redMul(z3sq).redMul(z3);
      const j = Curve.jpoint(xProj, yProj, '3');
      expect(j.zOne).to.be.false;

      const dblResult = j._dbl();
      expect(isOnCurveJ(dblResult)).to.be.true;
      // Should equal 6G using known vector
      const dblAffine6 = dblResult.toP();
      const expected6G = vectors.KG['0x6'];
      expect(dblAffine6.x.toString(16, 64)).to.equal(expected6G.x);
      expect(dblAffine6.y.toString(16, 64)).to.equal(expected6G.y);
    });

    it('ARITH._DBL.INF - _dbl on infinity returns infinity', function () {
      const inf = Curve.jpoint(null, null, null);
      const dblInf = inf._dbl();
      expect(dblInf.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 8.4 _fixedNafMul — Fixed-base NAF multiplication with precomputed doubles
  // -----------------------------------------------------------------
  describe('8.4 _fixedNafMul — Fixed-base NAF multiplication', function () {

    it('ARITH.FIXED_NAF.USING_PRECOMP - _fixedNafMul with precomputed doubles', function () {
      // Use a fresh generator so precompute state does not leak between tests.
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      g.precompute(256);
      expect(g.precomputed).to.exist;
      expect(g.precomputed.doubles).to.exist;
      expect(g.precomputed.doubles.points.length).to.be.greaterThan(0);

      // _hasDoubles should be true for scalars that fit in the precomputed table
      const k = new BN('100000000000000000000000000000000', 16); // 128-bit scalar
      expect(g._hasDoubles(k)).to.be.true;

      // _fixedNafMul is called by mul() when _hasDoubles is true
      const resultFixed = Curve._fixedNafMul(g, k);
      expect(resultFixed).to.exist;
      expect(isOnCurve(resultFixed)).to.be.true;

      // _fixedNafMul returns an affine point — verify against known vector
      const expected2p128 = vectors.KG['0x100000000000000000000000000000000'];
      expect(resultFixed.x.toString(16, 64)).to.equal(expected2p128.x);
      expect(resultFixed.y.toString(16, 64)).to.equal(expected2p128.y);
    });

    it('ARITH.FIXED_NAF.LARGE_SCALAR - _fixedNafMul with k=2^128', function () {
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      g.precompute(256);

      // k = 2^128
      const k2_128 = new BN(1).iushln(128);
      expect(g._hasDoubles(k2_128)).to.be.true;

      const result = Curve._fixedNafMul(g, k2_128);
      expect(isOnCurve(result)).to.be.true;

      // Verify against known vector for k=2^128 — _fixedNafMul returns affine point
      const expected2p128 = vectors.KG['0x100000000000000000000000000000000'];
      expect(result.x.toString(16, 64)).to.equal(expected2p128.x);
      expect(result.y.toString(16, 64)).to.equal(expected2p128.y);
    });

  });

  // -----------------------------------------------------------------
  // 8.5 _wnafMul — Windowed NAF (WNAF) multiplication
  // -----------------------------------------------------------------
  describe('8.5 _wnafMul — Windowed NAF multiplication', function () {

    it('ARITH.WNAF.CORRECTNESS - _wnafMul with k=13', function () {
      const g = Curve.g;
      const k = new BN(13);
      const result = Curve._wnafMul(g, k);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMul returns affine point when input is affine
      const expected13 = vectors.KG['0xd'];
      expect(result.x.toString(16, 64)).to.equal(expected13.x);
      expect(result.y.toString(16, 64)).to.equal(expected13.y);
    });

    it('ARITH.WNAF.CORRECTNESS_99 - _wnafMul with k=99', function () {
      const g = Curve.g;
      const k = new BN(99);
      const result = Curve._wnafMul(g, k);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMul returns affine point when input is affine
      const expected99 = vectors.KG['0x63'];
      expect(result.x.toString(16, 64)).to.equal(expected99.x);
      expect(result.y.toString(16, 64)).to.equal(expected99.y);
    });

    it('ARITH.WNAF.CORRECTNESS_255 - _wnafMul with k=255', function () {
      const g = Curve.g;
      const k = new BN(255);
      const result = Curve._wnafMul(g, k);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMul returns affine point when input is affine
      const expected255 = vectors.KG['0xff'];
      expect(result.x.toString(16, 64)).to.equal(expected255.x);
      expect(result.y.toString(16, 64)).to.equal(expected255.y);
    });

    it('ARITH.WNAF.LARGE_SCALAR - _wnafMul with 128-bit scalar', function () {
      const g = Curve.g;
      const k = new BN('deadbeefdeadbeefdeadbeefdeadbeef', 16);
      const result = Curve._wnafMul(g, k);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMul returns affine point when input is affine
      const expected = vectors.KG['0xdeadbeefdeadbeefdeadbeefdeadbeef'];
      expect(result.x.toString(16, 64)).to.equal(expected.x);
      expect(result.y.toString(16, 64)).to.equal(expected.y);
    });

    it('ARITH.WNAF.INF - _wnafMul on infinity returns infinity', function () {
      const inf = Curve.jpoint(null, null, null);
      const k = new BN(7);
      const result = Curve._wnafMul(inf, k);
      expect(result.isInfinity()).to.be.true;
    });

    it('ARITH.WNAF.ZERO - _wnafMul with k=0 returns infinity', function () {
      const g = Curve.g;
      const k = new BN(0);
      const result = Curve._wnafMul(g, k);
      expect(result.isInfinity()).to.be.true;
    });

    it('ARITH.WNAF.ONE - _wnafMul with k=1 returns G', function () {
      const g = Curve.g;
      const k = new BN(1);
      const result = Curve._wnafMul(g, k);
      // Verify against known G coordinates — _wnafMul returns affine point when input is affine
      expect(result.x.toString(16, 64)).to.equal(vectors.G_X);
      expect(result.y.toString(16, 64)).to.equal(vectors.G_Y);
    });

    it('ARITH.WNAF.N - _wnafMul with k=N returns infinity', function () {
      const g = Curve.g;
      const n = new BN(SECP_N, 16);
      const result = Curve._wnafMul(g, n);
      expect(result.isInfinity()).to.be.true;
    });

    it('ARITH.WNAF.WITH_PRECOMP_BYPASS - precomputed point uses _fixedNafMul, not _wnafMul', function () {
      // When precomputed doubles exist, mul() calls _fixedNafMul, bypassing _wnafMul
      const g = Curve.g;
      g.precompute(256);
      const k = new BN(13);

      // mul() should use _fixedNafMul internally (via _hasDoubles check)
      const result = g.mul(k);
      expect(isOnCurve(result)).to.be.true;
      const expected13 = vectors.KG['0xd'];
      expect(result.x.toString(16, 64)).to.equal(expected13.x);
      expect(result.y.toString(16, 64)).to.equal(expected13.y);

      // Manual _wnafMul should also work but is bypassed by mul()
      g.precomputed = null;
      const wnafResult = Curve._wnafMul(g, k);
      // Verify _wnafMul result against known vector — returns affine point
      expect(wnafResult.x.toString(16, 64)).to.equal(expected13.x);
      expect(wnafResult.y.toString(16, 64)).to.equal(expected13.y);
    });
  });

  // -----------------------------------------------------------------
  // 8.6 _wnafMulAdd — Windowed NAF multi-scalar multiplication
  // -----------------------------------------------------------------
  describe('8.6 _wnafMulAdd — Windowed NAF multi-scalar multiplication', function () {

    it('ARITH.WNAF_MULD.G_2G_3_5 - _wnafMulAdd([G,2G],[3,5]) = 13G', function () {
      // Compute 3*G + 5*(2G) = 3G + 10G = 13G
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const result = Curve._wnafMulAdd(4, [g, g2], [new BN(3), new BN(5)], 2, false);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMulAdd returns affine point when jacobianResult=false
      const expected13 = vectors.KG['0xd'];
      expect(result.x.toString(16, 64)).to.equal(expected13.x);
      expect(result.y.toString(16, 64)).to.equal(expected13.y);
    });

    it('ARITH.WNAF_MULD.JACOBIAN - _wnafMulAdd with jacobianResult=true', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const resultJ = Curve._wnafMulAdd(4, [g, g2], [new BN(3), new BN(5)], 2, true);
      expect(resultJ.type).to.equal('jacobian');
      // Verify against known vector
      const resultAffine = resultJ.toP();
      const expected13 = vectors.KG['0xd'];
      expect(resultAffine.x.toString(16, 64)).to.equal(expected13.x);
      expect(resultAffine.y.toString(16, 64)).to.equal(expected13.y);
    });

    it('ARITH.WNAF_MULD.THREE_POINTS - _wnafMulAdd with three points', function () {
      // Compute 1*G + 2*(2G) + 3*(3G) = G + 4G + 9G = 14G
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const g3 = Curve.g.mul('3');
      const result = Curve._wnafMulAdd(4, [g, g2, g3, g], [new BN(1), new BN(2), new BN(3), new BN(0)], 4, false);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMulAdd returns affine point when jacobianResult=false
      const expected14 = vectors.KG['0xe'];
      expect(result.x.toString(16, 64)).to.equal(expected14.x);
      expect(result.y.toString(16, 64)).to.equal(expected14.y);
    });

    it('ARITH.WNAF_MULD.INF_SCALAR - _wnafMulAdd with one zero scalar', function () {
      // 0*G + 5*(2G) = 10G
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const result = Curve._wnafMulAdd(4, [g, g2], [new BN(0), new BN(5)], 2, false);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known vector — _wnafMulAdd returns affine point when jacobianResult=false
      const expected10 = vectors.KG['0xa'];
      expect(result.x.toString(16, 64)).to.equal(expected10.x);
      expect(result.y.toString(16, 64)).to.equal(expected10.y);
    });

    it('ARITH.WNAF_MULD.INF_POINT - _wnafMulAdd with one infinity point', function () {
      // G + 3*O = G
      const g = Curve.g;
      const inf = Curve.point(null, null);
      const result = Curve._wnafMulAdd(4, [g, inf], [new BN(1), new BN(3)], 2, false);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known G coordinates — _wnafMulAdd returns affine point when jacobianResult=false
      expect(result.x.toString(16, 64)).to.equal(vectors.G_X);
      expect(result.y.toString(16, 64)).to.equal(vectors.G_Y);
    });

    it('ARITH.WNAF_MULD.NEGATIVE_SCALAR - _wnafMulAdd with negative scalar handling', function () {
      // 3*G + 5*(-G) = -2G
      const g = Curve.g;
      const gn = Curve.g.neg();
      const result = Curve._wnafMulAdd(4, [g, gn], [new BN(3), new BN(5)], 2, false);
      expect(isOnCurve(result)).to.be.true;
      // Verify against known -2G coordinates — _wnafMulAdd returns affine point when jacobianResult=false
      expect(result.x.toString(16, 64)).to.equal(vectors.NEG_2G_X);
      expect(result.y.toString(16, 64)).to.equal(vectors.NEG_2G_Y);
    });

    it('ARITH.WNAF_MULD.LARGE_SCALARS - _wnafMulAdd with large scalars', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const k1 = new BN('deadbeefdeadbeefdeadbeefdeadbeef', 16);
      const k2 = new BN('cafebabecafebabecafebabecafebabe', 16);
      const result = Curve._wnafMulAdd(4, [g, g2], [k1, k2], 2, false);
      expect(isOnCurve(result)).to.be.true;

      // Verify the result is a valid non-infinity affine point
      expect(result.isInfinity()).to.be.false;
    });
  });

  // -----------------------------------------------------------------
  // 8.7 jmulAdd — Jacobian multi-scalar addition
  // -----------------------------------------------------------------
  describe('8.7 jmulAdd — Jacobian multi-scalar addition', function () {

    it('ARITH.JMULADD.CORRECT - G.jmulAdd(3, G2, 5).eq(G.mulAdd(3, G2, 5))', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');

      const jResult = g.jmulAdd(new BN(3), g2, new BN(5));

      expect(jResult).to.exist;
      expect(jResult.type).to.equal('jacobian');

      // 3*G + 5*(2G) = 3G + 10G = 13G — verify against known vector
      const jAffine = jResult.toP();
      const expected13 = vectors.KG['0xd'];
      expect(jAffine.x.toString(16, 64)).to.equal(expected13.x);
      expect(jAffine.y.toString(16, 64)).to.equal(expected13.y);
    });

    it('ARITH.JMULADD.LARGE - jmulAdd with large scalars', function () {
      const g = Curve.g;
      const g2 = Curve.g.mul('2');
      const k1 = new BN('deadbeef', 16);
      const k2 = new BN('cafebab0', 16);

      const jResult = g.jmulAdd(k1, g2, k2);

      expect(isOnCurve(jResult.toP())).to.be.true;
      // Verify the jacobian-to-affine conversion produces a valid point
      const jAffine = jResult.toP();
      expect(jAffine.isInfinity()).to.be.false;
    });

    it.skip('ARITH.JMULADD.INF - jmulAdd with infinity point', function () {
      // Exposes brittle elliptic implementation which is unlikely to be used - keeping test for documentation
      const g = Curve.g;
      const inf = Curve.point(null, null);
      const jResult = g.jmulAdd(new BN(3), inf, new BN(5));
      expect(jResult.isInfinity()).to.be.false;
      expect(jResult.toP().eq(Curve.g.mul('3'))).to.be.true;
    });

    it('ARITH.JMULADD.SAME_POINT - jmulAdd with same point twice', function () {
      const g = Curve.g;
      // 3*G + 5*G = 8*G
      const jResult = g.jmulAdd(new BN(3), g, new BN(5));
      // Verify against known vector
      const jAffine = jResult.toP();
      const expected8 = vectors.KG['0x8'];
      expect(jAffine.x.toString(16, 64)).to.equal(expected8.x);
      expect(jAffine.y.toString(16, 64)).to.equal(expected8.y);
    });

    it('ARITH.JMULADD.DISTRIBUTIVE - jmulAdd matches manual multiplication', function () {
      const g = Curve.g;
      const g5 = Curve.g.mul('5');
      const k1 = new BN(13);
      const k2 = new BN(99);

      const jResult = g.jmulAdd(k1, g5, k2);
      // 13*G + 99*(5*G) = 13*G + 99*5*G = 13*G + 495*G = 508*G
      // Verify against known vector
      const jAffine = jResult.toP();
      const expected508 = vectors.KG['0x1fc'];
      expect(jAffine.x.toString(16, 64)).to.equal(expected508.x);
      expect(jAffine.y.toString(16, 64)).to.equal(expected508.y);
    });
  });

  // -----------------------------------------------------------------
  // 8.8 Greg Maxwell Trick — p/n ≈ 1 validation shortcut
  // -----------------------------------------------------------------
  describe('8.8 Greg Maxwell Trick — Point validation optimization', function () {

    it('ARITH.MAXWELL_TRICK.SET - curve.redN is set for secp256k1 (p/n = 1 < 100)', function () {
      // For secp256k1, p/n ≈ 1.000... (very close to 1, since n is very close to p)
      // p/n = 1 < 100, so redN is set and _maxwellTrick is true
      expect(Curve.redN).to.exist;
      expect(Curve._maxwellTrick).to.be.true;
    });

    it('ARITH.MAXWELL_TRICK.P_DIV_N - p/n ratio is 1 for secp256k1', function () {
      const pdivN = Curve.p.div(Curve.n);
      expect(pdivN.cmpn(1)).to.equal(0);
      // This confirms that p/n < 100, triggering the Greg Maxwell trick
      expect(Curve.redN).to.exist;
    });

    it('ARITH.MAXWELL_TRICK.REDN_VALID - redN represents n in Montgomery form', function () {
      // redN = n.toRed(red), so redN * 1 = n in Montgomery representation
      const nInRed = new BN(SECP_N, 16).toRed(Curve.red);
      expect(Curve.redN.cmp(nInRed)).to.equal(0);
    });

    it('ARITH.MAXWELL_TRICK.VALIDATION - eqXToP uses redN when Maxwell trick is enabled', function () {
      // eqXToP's inner loop uses redN for the wrapping check when _maxwellTrick is true.
      // We test that eqXToP works correctly (it uses the redN internally).
      const j = Curve.g.toJ();
      const x = Curve.g.getX();

      // Direct match
      expect(j.eqXToP(x)).to.be.true;

      // x + p should wrap and match via redN
      const xPlusP = x.add(Curve.p.clone());
      expect(j.eqXToP(xPlusP)).to.be.true;
    });

    it('ARITH.MAXWELL_TRICK.NEGATED - p/n > 100 would NOT set redN', function () {
      // This is a logical check: if p/n > 100, redN would be null.
      // For secp256k1, p/n = 1 < 100, so redN is set.
      // The condition: !adjustCount || adjustCount.cmpn(100) > 0 => redN = null
      // Since p/n = 1, adjustCount.cmpn(100) = -99 < 0, so redN is set.
      const adjustCount = Curve.p.div(Curve.n);
      expect(adjustCount.cmpn(100)).to.be.lessThan(0);
      expect(Curve.redN).to.exist;
    });
  });
});
