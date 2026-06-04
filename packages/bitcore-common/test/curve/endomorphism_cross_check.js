/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve } = require('../../');
const { expect } = require('chai');
const vectors = require('../data/secp256k1-vectors');

/**
 * Endomorphic Cross-Check Tests — Section 3.8
 *
 * These tests verify the endomorphism properties independently of the
 * scalar multiplication result by:
 * 1. Checking that endomorphismX(G.mul(k)) == G.mul(lambda*k mod n)
 * 2. Checking that endomorphismY(G.mul(k)) == G.mul(k) (y is unchanged)
 * 3. Verifying endo-split decomposition: k1*G + k2*(lambda*G) == G.mul(k)
 */

describe('Endomorphic cross-check — endomorphism properties vs scalar multiplication', function () {

  // Helper: check if a point satisfies y² = x³ + 7 (mod p)
  function isOnCurve(pt) {
    if (pt.isInfinity()) return true;
    const x = pt.getX();
    const y = pt.getY();
    const left = y.sqr().umod(Curve.p);
    const right = x.sqr().imul(x).iaddn(7).umod(Curve.p);
    return left.cmp(right) === 0;
  }

  const LAMBDA = Curve.endo.lambda;
  const BETA = Curve.endo.beta;

  // -----------------------------------------------------------------
  // EC1: Endomorphism X property: endomorphismX(G.mul(k)) == G.mul(lambda*k mod n)
  // -----------------------------------------------------------------
  describe('EC1: Endomorphic X — beta * P.x = (lambda * k * G).x', function () {

    // Scalars that are in the vector file (for direct vector comparison)
    const VECTOR_SCALARS = [
      { hex: '1', key: '0x1' },
      { hex: '2', key: '0x2' },
      { hex: '3', key: '0x3' },
      { hex: '7', key: '0x7' },
      { hex: '8', key: '0x8' },
      { hex: 'ff', key: '0xff' },
      { hex: '100', key: '0x100' },
      { hex: 'deadbeef', key: '0xdeadbeef' },
      { hex: 'deadbeefdeadbeefdeadbeefdeadbeef', key: '0xdeadbeefdeadbeefdeadbeefdeadbeef' },
    ];

    for (const { hex, key } of VECTOR_SCALARS) {
      it(`ENDO.X.K${key} - beta * (k*G).x == (lambda*k*G).x`, function () {
        const kP = Curve.g.mul(hex);
        expect(isOnCurve(kP)).to.be.true;

        // lambda * k mod n
        const kBN = new BN(hex, 16);
        const lambdaK = kBN.mul(LAMBDA).umod(Curve.n);
        const lambdaK_G = Curve.g.mul(lambdaK);
        expect(isOnCurve(lambdaK_G)).to.be.true;

        // beta * (kP).x should equal lambdaK_G.x
        const expectedX = kP.x.redMul(BETA);
        expect(lambdaK_G.x.cmp(expectedX)).to.equal(0);
        // y coordinates must be identical
        expect(lambdaK_G.y.cmp(kP.y)).to.equal(0);
      });
    }

    // Additional scalars without vector entries
    const NO_VECTOR_SCALARS = [
      '3ff',
      '7fff',
      'ffff',
      '10000',
    ];

    for (const hex of NO_VECTOR_SCALARS) {
      it(`ENDO.X.NOVEC_${hex} - beta * (k*G).x == (lambda*k*G).x`, function () {
        const kP = Curve.g.mul(hex);
        expect(isOnCurve(kP)).to.be.true;

        const kBN = new BN(hex, 16);
        const lambdaK = kBN.mul(LAMBDA).umod(Curve.n);
        const lambdaK_G = Curve.g.mul(lambdaK);
        expect(isOnCurve(lambdaK_G)).to.be.true;

        const expectedX = kP.x.redMul(BETA);
        expect(lambdaK_G.x.cmp(expectedX)).to.equal(0);
        expect(lambdaK_G.y.cmp(kP.y)).to.equal(0);
      });
    }

    // N-1 scalar (boundary test)
    it('ENDO.X.NMINUS1 - endomorphism holds for k = N-1', function () {
      const nMinus1 = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140';
      const kP = Curve.g.mul(nMinus1);
      expect(isOnCurve(kP)).to.be.true;

      const kBN = new BN(nMinus1, 16);
      const lambdaK = kBN.mul(LAMBDA).umod(Curve.n);
      const lambdaK_G = Curve.g.mul(lambdaK);
      expect(isOnCurve(lambdaK_G)).to.be.true;

      const expectedX = kP.x.redMul(BETA);
      expect(lambdaK_G.x.cmp(expectedX)).to.equal(0);
      expect(lambdaK_G.y.cmp(kP.y)).to.equal(0);
    });

    // Large random-looking scalar
    it('ENDO.X.LARGE - endomorphism holds for large 256-bit scalar', function () {
      const hex = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const kP = Curve.g.mul(hex);
      expect(isOnCurve(kP)).to.be.true;

      const kBN = new BN(hex, 16);
      const lambdaK = kBN.mul(LAMBDA).umod(Curve.n);
      const lambdaK_G = Curve.g.mul(lambdaK);
      expect(isOnCurve(lambdaK_G)).to.be.true;

      const expectedX = kP.x.redMul(BETA);
      expect(lambdaK_G.x.cmp(expectedX)).to.equal(0);
      expect(lambdaK_G.y.cmp(kP.y)).to.equal(0);
    });
  });

  // -----------------------------------------------------------------
  // EC2: Endomorphic Y property: endomorphismY(G.mul(k)) == G.mul(k) (y unchanged)
  // -----------------------------------------------------------------
  describe('EC2: Endomorphic Y — lambda*k*G and k*G share the same y coordinate', function () {

    const TEST_SCALARS = [
      '1',
      '2',
      '3',
      'ff',
      '100',
      'deadbeef',
      'deadbeefdeadbeefdeadbeefdeadbeef',
    ];

    for (const hex of TEST_SCALARS) {
      it(`ENDO.Y.K${hex} - y(lambda*k*G) == y(k*G)`, function () {
        const kP = Curve.g.mul(hex);
        const kBN = new BN(hex, 16);
        const lambdaK = kBN.mul(LAMBDA).umod(Curve.n);
        const lambdaK_G = Curve.g.mul(lambdaK);

        expect(lambdaK_G.y.cmp(kP.y)).to.equal(0);
      });
    }

    it('ENDO.Y.INFINITY - y(0*G) = y(infinity) trivially', function () {
      const zeroG = Curve.g.mul('0');
      expect(zeroG.isInfinity()).to.be.true;
    });

    it('ENDO.Y.N - y(N*G) = y(infinity) trivially', function () {
      const nG = Curve.g.mul('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
      expect(nG.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // EC3: Endo-split decomposition: k1*G + k2*(lambda*G) == k*G
  // -----------------------------------------------------------------
  describe('EC3: Endo-split decomposition — k1*G + k2*(λ*G) == k*G', function () {

    const TEST_SCALARS = [
      { hex: '1', tag: '1' },
      { hex: '2', tag: '2' },
      { hex: '3', tag: '3' },
      { hex: '7', tag: '7' },
      { hex: 'ff', tag: '0xff' },
      { hex: '100', tag: '0x100' },
      { hex: 'deadbeef', tag: 'deadbeef' },
      { hex: 'deadbeefdeadbeefdeadbeefdeadbeef', tag: 'deadbeef×4' },
      { hex: '100000000000000000000000000000000', tag: '2^128' },
    ];

    for (const { hex, tag } of TEST_SCALARS) {
      it(`ENDO.SPLIT.K${tag} - k1*G + k2*(λ*G) == k*G`, function () {
        const kBN = new BN(hex, 16);

        // Use the curve's _endoSplit to get k1, k2
        const split = Curve._endoSplit(kBN);
        const k1 = split.k1;
        const k2 = split.k2;

        // Reconstruct: k1*G + k2*(lambda*G)
        const k1G = Curve._endoWnafMulAdd([Curve.g], [k1]);
        const lambdaG = Curve.g.mul(LAMBDA);
        const k2LambdaG = Curve._endoWnafMulAdd([lambdaG], [k2]);
        const decomposed = k1G.add(k2LambdaG);

        // Direct computation: k*G
        const direct = Curve.g.mul(hex);

        expect(decomposed.eq(direct)).to.be.true;
        expect(isOnCurve(decomposed)).to.be.true;
      });
    }

    // N-1 boundary test
    it('ENDO.SPLIT.NMINUS1 - decomposition holds for k = N-1', function () {
      const nMinus1 = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140';
      const kBN = new BN(nMinus1, 16);

      const split = Curve._endoSplit(kBN);
      const k1G = Curve._endoWnafMulAdd([Curve.g], [split.k1]);
      const lambdaG = Curve.g.mul(LAMBDA);
      const k2LambdaG = Curve._endoWnafMulAdd([lambdaG], [split.k2]);
      const decomposed = k1G.add(k2LambdaG);

      const direct = Curve.g.mul(nMinus1);
      expect(decomposed.eq(direct)).to.be.true;
    });

    // Zero scalar
    it('ENDO.SPLIT.ZERO - decomposition holds for k = 0', function () {
      const kBN = new BN(0);
      const split = Curve._endoSplit(kBN);

      const k1G = Curve._endoWnafMulAdd([Curve.g], [split.k1]);
      const lambdaG = Curve.g.mul(LAMBDA);
      const k2LambdaG = Curve._endoWnafMulAdd([lambdaG], [split.k2]);
      const decomposed = k1G.add(k2LambdaG);

      const direct = Curve.g.mul('0');
      expect(decomposed.isInfinity()).to.be.true;
      expect(direct.isInfinity()).to.be.true;
    });

    // Large scalar matching full-width vector
    it('ENDO.SPLIT.FULL256 - decomposition holds for 256-bit scalar', function () {
      const hex = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const kBN = new BN(hex, 16);

      const split = Curve._endoSplit(kBN);
      const k1G = Curve._endoWnafMulAdd([Curve.g], [split.k1]);
      const lambdaG = Curve.g.mul(LAMBDA);
      const k2LambdaG = Curve._endoWnafMulAdd([lambdaG], [split.k2]);
      const decomposed = k1G.add(k2LambdaG);

      const direct = Curve.g.mul(hex);
      expect(decomposed.eq(direct)).to.be.true;
      expect(isOnCurve(decomposed)).to.be.true;

      // Also verify against vector
      const vec = vectors.KG['0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'];
      if (vec) {
        expect(decomposed.x.toString(16, 64)).to.equal(vec.x);
        expect(decomposed.y.toString(16, 64)).to.equal(vec.y);
      }
    });
  });

  // -----------------------------------------------------------------
  // EC4: Endomorphism × precompute interaction
  // -----------------------------------------------------------------
  describe('EC4: Precomputed endomorphism — beta caching consistency', function () {

    it('ENDO.PRECOMP.BETA_SAME - _getBeta() on precomputed G returns same result', function () {
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      g.precompute(256);

      const betaG1 = g._getBeta();
      const betaG2 = g._getBeta();
      expect(betaG1).to.equal(betaG2);
      expect(betaG1).to.equal(g.precomputed.beta);
    });

    it('ENDO.PRECOMP.LAMBDA_G_MATCHES_BETA_G - lambda*G == (beta*Gx, Gy)', function () {
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      const lambdaG = Curve.g.mul(LAMBDA);
      const betaG = g._getBeta();

      // lambda*G and beta*G should have matching coordinates
      expect(lambdaG.x.cmp(betaG.x)).to.equal(0);
      expect(lambdaG.y.cmp(betaG.y)).to.equal(0);
    });

    it('ENDO.PRECOMP.MULT_MATCH - precomputed mul matches vector for k=0x100', function () {
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      g.precompute(256);

      const result = g.mul('100');
      const vec = vectors.KG['0x100'];
      expect(result.x.toString(16, 64)).to.equal(vec.x);
      expect(result.y.toString(16, 64)).to.equal(vec.y);
    });

    it('ENDO.PRECOMP.MULT_MATCH - precomputed mul matches vector for k=2^128', function () {
      const g = Curve.point(Curve.g.getX(), Curve.g.getY());
      g.precompute(256);

      const result = g.mul('100000000000000000000000000000000');
      const vec = vectors.KG['0x100000000000000000000000000000000'];
      expect(result.x.toString(16, 64)).to.equal(vec.x);
      expect(result.y.toString(16, 64)).to.equal(vec.y);
    });
  });
});
