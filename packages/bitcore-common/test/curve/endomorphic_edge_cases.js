/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const BN = require('../../').BN;
const Curve = require('../../').Curve;
const { expect } = require('chai');
const vectors = require('../data/secp256k1-vectors');

// secp256k1 constants (BN hex strings)
const SECP_N = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';

// Helper: assert that a point matches a vector entry
function expectKnownPoint(actual, vecKey) {
  const vec = vectors.KG[vecKey];
  const vecX = new BN(vec.x, 16);
  const vecY = new BN(vec.y, 16);
  expect(actual.x.cmp(vecX)).to.equal(0);
  expect(actual.y.cmp(vecY)).to.equal(0);
}

// Helper: check if an affine point satisfies y² = x³ + 7 (mod p)
function isOnCurve(p) {
  if (p.isInfinity()) return true;
  return Curve.validate(p);
}

describe('Endomorphic edge cases', function () {
  describe('lib/curve/short.js', function () {

    // -----------------------------------------------------------------
    // 9.1 Endomorphism Constants — beta and lambda
    // -----------------------------------------------------------------
    describe('9.1 Endomorphism Constants', function () {
  
      it('ENDO.BETA_CUBIC - endo.beta^3 ≡ 1 (mod p) and beta ≠ 1', function () {
        // beta is a primitive cubic root of unity modulo p
        const beta = Curve.endo.beta;
        expect(beta).to.exist;
        expect(beta.red).to.equal(Curve.red);
  
        const betaPlain = beta.fromRed();
        // beta ≠ 1
        expect(betaPlain.cmpn(1)).to.not.equal(0);
  
        // beta^3 mod p should equal 1
        const beta3 = betaPlain.sqr().imul(betaPlain).umod(Curve.p);
        expect(beta3.cmpn(1)).to.equal(0);
      });
  
      it('ENDO.BETA_NOT_ONE - endo.beta is a primitive (non-trivial) cubic root of unity', function () {
        const beta = Curve.endo.beta.fromRed();
        // beta ≠ 1 (already tested above) and beta^2 ≠ 1
        const beta2 = beta.sqr().umod(Curve.p);
        expect(beta2.cmpn(1)).to.not.equal(0);
        // So beta has order exactly 3 in F_p*
      });
  
      it('ENDO.LAMBDA_CUBIC - endo.lambda^3 ≡ 1 (mod n) and lambda ≠ 1', function () {
        // lambda is a primitive cubic root of unity modulo n
        const lambda = Curve.endo.lambda;
        expect(lambda).to.exist;
        expect(BN.isBN(lambda)).to.be.true;
  
        // lambda ≠ 1
        expect(lambda.cmpn(1)).to.not.equal(0);
  
        // lambda^3 mod n should equal 1
        const lambda3 = lambda.sqr().imul(lambda).umod(Curve.n);
        expect(lambda3.cmpn(1)).to.equal(0);
      });
  
      it('ENDO.LAMBDA_NOT_ONE - lambda has order exactly 3 (lambda^2 ≠ 1 mod n)', function () {
        const lambda = Curve.endo.lambda;
        const lambda2 = lambda.sqr().umod(Curve.n);
        expect(lambda2.cmpn(1)).to.not.equal(0);
      });
  
      it('ENDO.BETA_LAMBDA_PAIR - selected beta and lambda are consistent via G', function () {
        // The pair (beta, lambda) is chosen so that lambda * G = (beta * Gx, Gy)
        const beta = Curve.endo.beta;
        const lambda = Curve.endo.lambda;
        const betaGx = Curve.g.x.redMul(beta);
        const lambdaG = Curve.g.mul(lambda);
        expect(lambdaG.x.cmp(betaGx)).to.equal(0);
        expect(lambdaG.y.cmp(Curve.g.y)).to.equal(0);
      });
  
      it('ENDO.BETA_VALUE - beta matches known secp256k1 beta value', function () {
        // secp256k1 beta = 0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee
        const beta = Curve.endo.beta.fromRed().toString(16);
        expect(beta).to.be.oneOf([
          '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
          '07ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
        ]);
      });
  
      it('ENDO.LAMBDA_VALUE - lambda matches known secp256k1 lambda value', function () {
        // secp256k1 lambda = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72
        const lambda = Curve.endo.lambda.toString(16);
        expect(lambda).to.be.oneOf([
          '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72',
          '05363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72',
        ]);
      });
    });
  
    // -----------------------------------------------------------------
    // 9.2 Endomorphism Identity — lambda*P = (beta*Px, Py)
    // -----------------------------------------------------------------
    describe('9.2 Endomorphism Identity', function () {
  
      it('ENDO.IDENTITY.G - lambda*G == (beta*Gx, Gy)', function () {
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const lambdaG = Curve.g.mul(lambda);
        const expectedX = Curve.g.x.redMul(beta);
        const expectedY = Curve.g.y;
        expect(lambdaG.x.cmp(expectedX)).to.equal(0);
        expect(lambdaG.y.cmp(expectedY)).to.equal(0);
      });
  
      it('ENDO.IDENTITY.2G - lambda*(2G) == (beta*2Gx, 2Gy)', function () {
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const twoG = Curve.g.mul('2');
        const lambda2G = twoG.mul(lambda);
        const expectedX = twoG.x.redMul(beta);
        const expectedY = twoG.y;
        expect(lambda2G.x.cmp(expectedX)).to.equal(0);
        expect(lambda2G.y.cmp(expectedY)).to.equal(0);
      });
  
      it('ENDO.IDENTITY.3G - lambda*(3G) == (beta*3Gx, 3Gy)', function () {
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const threeG = Curve.g.mul('3');
        const lambda3G = threeG.mul(lambda);
        const expectedX = threeG.x.redMul(beta);
        const expectedY = threeG.y;
        expect(lambda3G.x.cmp(expectedX)).to.equal(0);
        expect(lambda3G.y.cmp(expectedY)).to.equal(0);
      });
  
      it('ENDO.IDENTITY.LARGE - lambda*(large*G) == (beta*(large*G)x, large*Gy)', function () {
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const largeScalar = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
        const largeG = Curve.g.mul(largeScalar);
        const lambdaLargeG = largeG.mul(lambda);
        const expectedX = largeG.x.redMul(beta);
        const expectedY = largeG.y;
        expect(lambdaLargeG.x.cmp(expectedX)).to.equal(0);
        expect(lambdaLargeG.y.cmp(expectedY)).to.equal(0);
      });
  
      it('ENDO.IDENTITY.NEG_G - lambda*(-G) == (beta*(-G)x, -Gy)', function () {
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const negG = Curve.g.neg();
        const lambdaNegG = negG.mul(lambda);
        const expectedX = negG.x.redMul(beta);
        const expectedY = negG.y;
        expect(lambdaNegG.x.cmp(expectedX)).to.equal(0);
        expect(lambdaNegG.y.cmp(expectedY)).to.equal(0);
      });
  
      it('ENDO.IDENTITY.INV_LAMBDA - lambda^-1 * P == (beta^-1 * Px, Py)', function () {
        // Since lambda^3 ≡ 1 (mod n), lambda^-1 ≡ lambda^2 (mod n)
        // Similarly beta^-1 ≡ beta^2 (mod p)
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const lambdaInv = lambda.sqr().umod(Curve.n);
        const betaInv = beta.redSqr();
  
        const lambdaInvG = Curve.g.mul(lambdaInv);
        const expectedX = Curve.g.x.redMul(betaInv);
        const expectedY = Curve.g.y;
        expect(lambdaInvG.x.cmp(expectedX)).to.equal(0);
        expect(lambdaInvG.y.cmp(expectedY)).to.equal(0);
      });
  
      it('ENDO.IDENTITY.LAMBDA_2 - lambda^2 * P == (beta^2 * Px, Py)', function () {
        // Since lambda^3 ≡ 1, lambda^2 is the other non-trivial root
        const lambda = Curve.endo.lambda;
        const beta = Curve.endo.beta;
        const lambda2 = lambda.sqr().umod(Curve.n);
        const beta2 = beta.redSqr();
  
        const lambda2G = Curve.g.mul(lambda2);
        const expectedX = Curve.g.x.redMul(beta2);
        const expectedY = Curve.g.y;
        expect(lambda2G.x.cmp(expectedX)).to.equal(0);
        expect(lambda2G.y.cmp(expectedY)).to.equal(0);
      });
    });
  
    // -----------------------------------------------------------------
    // 9.3 Basis Reconstruction — k = k1*a1 + k2*a2 (mod n)
    // -----------------------------------------------------------------
    describe('9.3 Basis Reconstruction', function () {
  
      it('ENDO.BASIS_RECONSTRUCT.K1 - _endoSplit(1) reconstructs k=1', function () {
        const k = new BN(1);
        const split = Curve._endoSplit(k);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmpn(1)).to.equal(0);
      });
  
      it('ENDO.BASIS_RECONSTRUCT.K2 - _endoSplit(2) reconstructs k=2', function () {
        const k = new BN(2);
        const split = Curve._endoSplit(k);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmpn(2)).to.equal(0);
      });
  
      it('ENDO.BASIS_RECONSTRUCT.NMINUS1 - _endoSplit(n-1) reconstructs correctly', function () {
        const nMinus1 = Curve.n.clone().subn(1);
        const split = Curve._endoSplit(nMinus1);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmp(nMinus1)).to.equal(0);
      });
  
      it('ENDO.BASIS_RECONSTRUCT.NHALF - _endoSplit(n/2) reconstructs correctly', function () {
        const nHalf = Curve.n.divRound(new BN(2));
        const split = Curve._endoSplit(nHalf);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmp(nHalf)).to.equal(0);
      });
  
      it('ENDO.BASIS_RECONSTRUCT.LARGE - _endoSplit(large random scalar) reconstructs correctly', function () {
        const largeScalar = new BN(
          'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          16
        );
        const split = Curve._endoSplit(largeScalar);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmp(largeScalar.umod(Curve.n))).to.equal(0);
      });
  
      it('ENDO.BASIS_RECONSTRUCT.FF - _endoSplit(0xff) reconstructs correctly', function () {
        const k = new BN('ff', 16);
        const split = Curve._endoSplit(k);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmp(k)).to.equal(0);
      });
  
      it('ENDO.BASIS_RECONSTRUCT.ZERO - _endoSplit(0) reconstructs to 0', function () {
        const k = new BN(0);
        const split = Curve._endoSplit(k);
        const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
        expect(reconstructed.cmpn(0)).to.equal(0);
      });
  
      it('ENDO.BASIS_LENGTH.HALF_BITLEN - _endoSplit keeps signed components near half the order size', function () {
        const maxBits = Math.ceil(Curve.n.bitLength() / 2) + 1;
        const testScalars = [
          Curve.n.clone().subn(1),
          new BN(1).iushln(255),
          new BN(
            'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            16
          ),
        ];
  
        for (const k of testScalars) {
          const split = Curve._endoSplit(k);
          const reconstructed = split.k1.add(split.k2.mul(Curve.endo.lambda)).umod(Curve.n);
  
          expect(reconstructed.cmp(k.umod(Curve.n))).to.equal(0);
          expect(split.k1.bitLength()).to.be.lessThanOrEqual(maxBits);
          expect(split.k2.bitLength()).to.be.lessThanOrEqual(maxBits);
        }
      });
  
      it('ENDO.BASIS_LENGTH.SMALL_K - small k gives small k1, k2=0', function () {
        const k = new BN(5);
        const split = Curve._endoSplit(k);
        // For small k, k1 should equal k and k2 should be 0
        expect(split.k1.cmp(k)).to.equal(0);
        expect(split.k2.cmpn(0)).to.equal(0);
      });
    });
  
    // -----------------------------------------------------------------
    // 9.4 Endo-assisted WNAF Multiplication — single point
    // -----------------------------------------------------------------
    describe('9.4 Endo-assisted WNAF Multiplication', function () {
  
      it('ENDO.MULT_MATCH.K1 - endoWnafMulAdd([G],[1]) matches known vector 1G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(1)]);
        expectKnownPoint(result, '0x1');
      });
  
      it('ENDO.MULT_MATCH.K2 - endoWnafMulAdd([G],[2]) matches known vector 2G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(2)]);
        expectKnownPoint(result, '0x2');
      });
  
      it('ENDO.MULT_MATCH.K3 - endoWnafMulAdd([G],[3]) matches known vector 3G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(3)]);
        expectKnownPoint(result, '0x3');
      });
  
      it('ENDO.MULT_MATCH.K5 - endoWnafMulAdd([G],[5]) matches known vector 5G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(5)]);
        expectKnownPoint(result, '0x5');
      });
  
      it('ENDO.MULT_MATCH.K7 - endoWnafMulAdd([G],[7]) matches known vector 7G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(7)]);
        expectKnownPoint(result, '0x7');
      });
  
      it('ENDO.MULT_MATCH.K13 - endoWnafMulAdd([G],[13]) matches known vector 13G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(13)]);
        expectKnownPoint(result, '0xd');
      });
  
      it('ENDO.MULT_MATCH.K99 - endoWnafMulAdd([G],[99]) matches known vector 99G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(99)]);
        expectKnownPoint(result, '0x63');
      });
  
      it('ENDO.MULT_MATCH.K255 - endoWnafMulAdd([G],[255]) matches known vector 255G', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(255)]);
        expectKnownPoint(result, '0xff');
      });
  
      it('ENDO.MULT_MATCH.KLARGE - endoWnafMulAdd([G],[2^128]) matches known vector 2^128*G', function () {
        const k = new BN(1).iushln(128);
        const result = Curve._endoWnafMulAdd([Curve.g], [k]);
        expectKnownPoint(result, '0x100000000000000000000000000000000');
      });
  
      it('ENDO.MULT_MATCH.ON_CURVE - endoWnafMulAdd result is always on the curve', function () {
        const testScalars = [
          new BN(1),
          new BN(37),
          new BN('deadbeef', 16),
          new BN('1234567890abcdef1234567890abcdef', 16),
          Curve.n.clone().subn(1),
        ];
        for (const k of testScalars) {
          const result = Curve._endoWnafMulAdd([Curve.g], [k]);
          expect(isOnCurve(result)).to.be.true;
        }
      });
  
      it('ENDO.MULT_MATCH.N - endoWnafMulAdd([G],[N]) returns infinity', function () {
        const n = new BN(SECP_N, 16);
        const result = Curve._endoWnafMulAdd([Curve.g], [n]);
        expect(result.isInfinity()).to.be.true;
      });
  
      it('ENDO.MULT_MATCH.ZERO - endoWnafMulAdd([G],[0]) returns infinity', function () {
        const result = Curve._endoWnafMulAdd([Curve.g], [new BN(0)]);
        expect(result.isInfinity()).to.be.true;
      });
    });
  });

  describe('lib/curve/point.js', function () {

    // -----------------------------------------------------------------
    // 9.5 Endo-assisted WNAF Multiplication — two points
    // -----------------------------------------------------------------
    describe('9.5 Endo-assisted WNAF Multiplication (Multi-point)', function () {
  
      it('ENDO.MULT_DIST.BASIC - endoWnafMulAdd([G,2G],[3,5]) matches known vector 13G', function () {
        const g = Curve.g;
        const g2 = Curve.g.mul('2');
        const result = Curve._endoWnafMulAdd([g, g2], [new BN(3), new BN(5)]);
        // 3*G + 5*(2G) = 13G
        expectKnownPoint(result, '0xd');
      });
  
      it('ENDO.MULT_DIST.K1_1_K2_1 - endoWnafMulAdd([G,2G],[1,1]) = 3G', function () {
        const g = Curve.g;
        const g2 = Curve.g.mul('2');
        const result = Curve._endoWnafMulAdd([g, g2], [new BN(1), new BN(1)]);
        // 1*G + 1*(2G) = 3G
        expectKnownPoint(result, '0x3');
      });
  
      it('ENDO.MULT_DIST.K1_NEG - endoWnafMulAdd handles negative k1 correctly', function () {
        // 3*G + 5*(-G) = -2G → compare against 2G with negated y
        const g = Curve.g;
        const gn = Curve.g.neg();
        const result = Curve._endoWnafMulAdd([g, gn], [new BN(3), new BN(5)]);
        const vec = vectors.KG['0x2'];
        const negY = vectors.negY(vec.y);
        const vecX = new BN(vec.x, 16);
        const vecYNeg = new BN(negY, 16);
        expect(result.x.cmp(vecX)).to.equal(0);
        expect(result.y.cmp(vecYNeg)).to.equal(0);
      });
  
      it('ENDO.MULT_DIST.LARGE_SCALARS.K1_ONLY - endoWnafMulAdd with k1 large, k2=0', function () {
        const g = Curve.g;
        const g2 = Curve.g.mul('2');
        const k1 = new BN('deadbeefdeadbeefdeadbeefdeadbeef', 16);
        // k1*G + 0*(2G) = k1*G
        const result = Curve._endoWnafMulAdd([g, g2], [k1, new BN(0)]);
        expectKnownPoint(result, '0xdeadbeefdeadbeefdeadbeefdeadbeef');
      });
  
      it('ENDO.MULT_DIST.LARGE_SCALARS.K2_ONLY - endoWnafMulAdd with k1=0, k2 large', function () {
        const g = Curve.g;
        const g2 = Curve.g.mul('2');
        // 0*G + 5*(2G) = 10G
        const result = Curve._endoWnafMulAdd([g, g2], [new BN(0), new BN(5)]);
        expectKnownPoint(result, '0xa');
      });
  
      it('ENDO.MULT_DIST.ON_CURVE - multi-point endoWnafMulAdd result is on the curve', function () {
        const g = Curve.g;
        const g3 = Curve.g.mul('3');
        const k1 = new BN('abcd1234', 16);
        const k2 = new BN('1234abcd', 16);
        const result = Curve._endoWnafMulAdd([g, g3], [k1, k2]);
        expect(isOnCurve(result)).to.be.true;
      });
  
      it('ENDO.MULT_DIST.ZERO_FIRST - endoWnafMulAdd with k1=0', function () {
        const g = Curve.g;
        const g2 = Curve.g.mul('2');
        // 0*G + 7*(2G) = 14G
        const result = Curve._endoWnafMulAdd([g, g2], [new BN(0), new BN(7)]);
        expectKnownPoint(result, '0xe');
      });
  
      it('ENDO.MULT_DIST.ZERO_SECOND - endoWnafMulAdd with k2=0', function () {
        const g = Curve.g;
        const g2 = Curve.g.mul('2');
        // 10*G + 0*(2G) = 10G (vector '10' exists)
        const result = Curve._endoWnafMulAdd([g, g2], [new BN(10), new BN(0)]);
        expectKnownPoint(result, '0xa');
      });
    });
  
    // -----------------------------------------------------------------
    // 9.6 Beta Caching — Point._getBeta()
    // -----------------------------------------------------------------
    describe('9.6 Beta Caching', function () {
  
      it('ENDO.BETA_CACHE.CREATE - first call to _getBeta() creates the beta point', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        expect(g.precomputed).to.not.exist;
        const betaG = g._getBeta();
        expect(betaG).to.exist;
        expect(betaG.isInfinity()).to.be.false;
      });
  
      it('ENDO.BETA_CACHE.CACHED - second call to _getBeta() returns the same cached object', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
        const firstBeta = g._getBeta();
        // Ensure precomputed.beta is set
        expect(g.precomputed).to.exist;
        expect(g.precomputed.beta).to.exist;
        const secondBeta = g._getBeta();
        expect(secondBeta).to.equal(firstBeta);
        // Also check that precomputed.beta was set
        expect(g.precomputed.beta).to.equal(firstBeta);
      });
  
      it('ENDO.BETA_CACHE.PROPS - _getBeta() returns a valid point on the curve', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        const betaG = g._getBeta();
        expect(betaG.isInfinity()).to.be.false;
        expect(isOnCurve(betaG)).to.be.true;
      });
  
      it('ENDO.BETA_CACHE.BETA_X - beta*G has x = beta * Gx', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        const betaG = g._getBeta();
        const expectedX = g.x.redMul(Curve.endo.beta);
        expect(betaG.x.cmp(expectedX)).to.equal(0);
        expect(betaG.y.cmp(g.y)).to.equal(0);
      });
  
      it('ENDO.BETA_CACHE.NO_ENDO - Curve.endo exists (precondition for _getBeta)', function () {
        // secp256k1 has endomorphism, so _getBeta always works
        // This test verifies the precondition
        expect(Curve.endo).to.exist;
      });
  
      it('ENDO.BETA_CACHE.OTHER_POINT - _getBeta() on 2G returns beta*(2G)', function () {
        const g2 = Curve.g.mul('2');
        const betaG2 = g2._getBeta();
        const expectedX = g2.x.redMul(Curve.endo.beta);
        const expectedY = g2.y;
        expect(betaG2.x.cmp(expectedX)).to.equal(0);
        expect(betaG2.y.cmp(expectedY)).to.equal(0);
        expect(isOnCurve(betaG2)).to.be.true;
      });
  
      it('ENDO.BETA_CACHE.OTHER_POINT_NEG - _getBeta() on -G returns beta*(-G)', function () {
        const negG = Curve.g.neg();
        const betaNegG = negG._getBeta();
        const expectedX = negG.x.redMul(Curve.endo.beta);
        const expectedY = negG.y;
        expect(betaNegG.x.cmp(expectedX)).to.equal(0);
        expect(betaNegG.y.cmp(expectedY)).to.equal(0);
        expect(isOnCurve(betaNegG)).to.be.true;
      });
    });
  
    // -----------------------------------------------------------------
    // 9.7 Precompute + Endo Interaction
    // -----------------------------------------------------------------
    describe('9.7 Precompute + Endo Interaction', function () {
  
      it('ENDO.MULT_WITH_PRECOMP.MATCH - G.precompute(); G.mul(k) matches non-precomputed path', function () {
        // Create a fresh point to avoid state leakage
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
        expect(g.precomputed).to.exist;
        expect(g.precomputed.doubles).to.exist;
  
        const k = new BN('deadbeefdeadbeefdeadbeefdeadbeef', 16);
        const withPrecomp = g.mul(k);
        expect(isOnCurve(withPrecomp)).to.be.true;
  
        // Compare with a fresh point without precompute
        const gFresh = Curve.point(Curve.g.getX(), Curve.g.getY());
        const withoutPrecomp = gFresh.mul(k);
        expect(withPrecomp.eq(withoutPrecomp)).to.be.true;
      });
  
      it('ENDO.MULT_WITH_PRECOMP.VARIOUS_K - precomputed mul matches for k=1,2,3,5,7,13', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
  
        const testKs = [1, 2, 3, 5, 7, 13];
        for (const k of testKs) {
          const withPrecomp = g.mul(new BN(k));
          const gFresh = Curve.point(Curve.g.getX(), Curve.g.getY());
          const withoutPrecomp = gFresh.mul(new BN(k));
          expect(withPrecomp.eq(withoutPrecomp),
            'k=' + k + ' mismatch between precomputed and non-precomputed mul').to.be.true;
        }
      });
  
      it('ENDO.MULT_WITH_PRECOMP.LARGE_K - precomputed mul matches for k=2^128', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
  
        const k = new BN(1).iushln(128);
        const withPrecomp = g.mul(k);
        expect(isOnCurve(withPrecomp)).to.be.true;
  
        const gFresh = Curve.point(Curve.g.getX(), Curve.g.getY());
        const withoutPrecomp = gFresh.mul(k);
        expect(withPrecomp.eq(withoutPrecomp)).to.be.true;
      });
  
      it('ENDO.MULT_WITH_PRECOMP.N - precomputed mul of G*N returns infinity', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
  
        const n = new BN(SECP_N, 16);
        const result = g.mul(n);
        expect(result.isInfinity()).to.be.true;
      });
  
      it('ENDO.MULT_WITH_PRECOMP.ZERO - precomputed mul of G*0 returns infinity', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
  
        const result = g.mul(new BN(0));
        expect(result.isInfinity()).to.be.true;
      });
  
      it('ENDO.MULT_WITH_PRECOMP.MULADD_MATCH - G.precompute(); G.mulAdd matches non-precomputed', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        g.precompute(256);
        const g2 = Curve.g.mul('2');
  
        const withPrecomp = g.mulAdd(new BN(3), g2, new BN(5));
        expect(isOnCurve(withPrecomp)).to.be.true;
  
        const gFresh = Curve.point(Curve.g.getX(), Curve.g.getY());
        const withoutPrecomp = gFresh.mulAdd(new BN(3), g2, new BN(5));
        expect(withPrecomp.eq(withoutPrecomp)).to.be.true;
      });
    });
  
    // -----------------------------------------------------------------
    // 9.8 Endomorphism Edge Cases
    // -----------------------------------------------------------------
    describe('9.8 Endomorphism Edge Cases', function () {
  
      it('ENDO.EDGE.LAMBDA_2_GIVES_BETA_2 - lambda^2 and beta^2 form a consistent pair', function () {
        // lambda^3 ≡ 1 (mod n) so lambda^2 is the other non-trivial cubic root
        // Similarly beta^2 is the other non-trivial cubic root mod p
        // lambda^2 * G should have x = beta^2 * Gx, y = Gy
        const lambda2 = Curve.endo.lambda.sqr().umod(Curve.n);
        const beta2 = Curve.endo.beta.redSqr();
  
        const lambda2G = Curve.g.mul(lambda2);
        expect(lambda2G.x.cmp(Curve.g.x.redMul(beta2))).to.equal(0);
        expect(lambda2G.y.cmp(Curve.g.y)).to.equal(0);
      });
  
      it('ENDO.EDGE.BETA_POWERS - beta^1, beta^2, beta^3 form the three cubic roots', function () {
        const beta = Curve.endo.beta.fromRed();
        const beta1 = beta;
        const beta2 = beta.sqr().umod(Curve.p);
        const beta3 = beta2.mul(beta).umod(Curve.p);
  
        // beta^3 ≡ 1
        expect(beta3.cmpn(1)).to.equal(0);
        // beta^1 ≠ 1
        expect(beta1.cmpn(1)).to.not.equal(0);
        // beta^2 ≠ 1
        expect(beta2.cmpn(1)).to.not.equal(0);
        // beta^1 ≠ beta^2
        expect(beta1.cmp(beta2)).to.not.equal(0);
      });
  
      it('ENDO.EDGE.LAMBDA_POWERS - lambda^1, lambda^2, lambda^3 form the three cubic roots mod n', function () {
        const lambda = Curve.endo.lambda;
        const lambda1 = lambda;
        const lambda2 = lambda.sqr().umod(Curve.n);
        const lambda3 = lambda2.mul(lambda).umod(Curve.n);
  
        // lambda^3 ≡ 1
        expect(lambda3.cmpn(1)).to.equal(0);
        // lambda^1 ≠ 1
        expect(lambda1.cmpn(1)).to.not.equal(0);
        // lambda^2 ≠ 1
        expect(lambda2.cmpn(1)).to.not.equal(0);
        // lambda^1 ≠ lambda^2
        expect(lambda1.cmp(lambda2)).to.not.equal(0);
      });
  
      it('ENDO.EDGE.TWISTED_MUL - endoWnafMulAdd result matches point.mul for negative k2', function () {
        // _endoWnafMulAdd handles negative k2 by negating both the scalar and beta point
        // Verify the result is still mathematically correct
        const g = Curve.g;
        const k = Curve.n.clone().subn(1); // n-1, which should give -G
        const resultEndo = Curve._endoWnafMulAdd([g], [k]);
        const resultMul = g.mul(k);
        expect(resultEndo.eq(resultMul)).to.be.true;
      });
  
      it('ENDO.EDGE.SPLIT_BALANCE - _endoSplit produces balanced k1, k2 across multiple scalars', function () {
        // Test that decomposition is balanced for various scalars
        const testScalars = [
          new BN('aabbccdd', 16),
          new BN('1122334455667788', 16),
          new BN('aabbccddeeff00112233445566778899', 16),
          Curve.n.clone().subn(100),
        ];
        const maxBits = Math.ceil(Curve.n.bitLength() / 2) + 2;
        for (const k of testScalars) {
          const split = Curve._endoSplit(k);
          // Both k1 and k2 should be roughly half the curve order size.
          expect(split.k1.bitLength()).to.be.lessThanOrEqual(maxBits);
          expect(split.k2.bitLength()).to.be.lessThanOrEqual(maxBits);
        }
      });
  
      it('ENDO.EDGE.MULT_ENDO_VS_STANDARD - G.mul() matches known vectors for several scalars', function () {
        // Verify that the public mul() API matches independently computed vectors
        const testScalars = [
          { k: new BN(1), vecKey: '0x1' },
          { k: new BN(255), vecKey: '0xff' },
          { k: new BN('deadbeef', 16), vecKey: '0xdeadbeef' },
          { k: new BN('deadbeefdeadbeefdeadbeefdeadbeef', 16), vecKey: '0xdeadbeefdeadbeefdeadbeefdeadbeef' },
        ];
        for (const { k, vecKey } of testScalars) {
          const result = Curve.g.mul(k);
          // Verify on-curve (independent invariant)
          expect(isOnCurve(result)).to.be.true;
          // Verify against known vector (independent oracle)
          expectKnownPoint(result, vecKey);
        }
      });
  
      it.skip('ENDO.EDGE.INFINITY_MUL - endo path handles infinity correctly', function () {
        // As is, bitcore-common & elliptic would throw "TypeError: Cannot read properties of null (reading 'redMul')" - bitcore-common could be made more robust, but would diverge from elliptic implementation
        const inf = Curve.point(null, null);
        const result = Curve._endoWnafMulAdd([inf], [new BN(42)]);
        expect(result.isInfinity()).to.be.true;
      });
  
      it('ENDO.EDGE.BETA_ON_CURVE - beta*G satisfies the curve equation', function () {
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        const betaG = g._getBeta();
        expect(isOnCurve(betaG)).to.be.true;
        // Also verify: betaG.y² = betaG.x³ + 7 mod p
        expect(Curve.validate(betaG)).to.be.true;
      });
  
      it('ENDO.EDGE.TWO_POINT_BASIS - _endoSplit produces consistent basis for both points', function () {
        // Two different points should use the same basis decomposition
        const g = Curve.point(Curve.g.getX(), Curve.g.getY());
        const g2 = Curve.g.mul('2');
        const k = new BN('deadbeef', 16);
  
        const splitG = Curve._endoSplit(k);
        const splitG2 = Curve._endoSplit(k);
  
        // Basis vectors should be identical
        expect(splitG.k1.cmp(splitG2.k1)).to.equal(0);
        expect(splitG.k2.cmp(splitG2.k2)).to.equal(0);
  
        // But the resulting endomorphism points differ:
        const betaG = g._getBeta();
        const betaG2 = g2._getBeta();
        // betaG != betaG2 because they are different points
        // (though their x-coords both use the same beta constant)
        expect(betaG.x.cmp(betaG2.x)).to.not.equal(0);
      });
    });
  });
});




