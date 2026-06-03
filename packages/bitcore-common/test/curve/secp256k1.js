/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve } = require('../../');
const { expect } = require('chai');
const vectors = require('../data/secp256k1-vectors');

// secp256k1 constants (BN hex strings)
const SECP_P = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f';
const SECP_N = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';
const SECP_G_X = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SECP_G_Y = '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';

function expectPointMatchesVector(point, vector) {
  expect(point.isInfinity()).to.be.false;
  expect(point.getX().toString(16, 64)).to.equal(vector.x);
  expect(point.getY().toString(16, 64)).to.equal(vector.y);
}

// Basis vectors from _getEndoBasis for secp256k1
// a1 = 0x30e567f25f4c8ca219fe85e649bcaa830d6db3e9685841f38c69e643a36856e (approx 128 bit)
// b1 = 0x1685110c9023495b4e694675997770e98f06041804754a99085e8fb709672841
// a2 = 0x133e79b4d2774d4096a73813e6cf07ad8a9777b74a0e566a8d9337997473b5f7
// b2 = 0x106436411a5df78ee3c7c6143b763380b2831303e5e5194e62bcfcfc38bc0176
// These are computed by the curve itself, so we test them dynamically.

describe('Curve (secp256k1 Configuration)', function () {

  // -----------------------------------------------------------------
  // 3.1 Field Prime and Group Order
  // -----------------------------------------------------------------
  describe('3.1 Field Prime and Group Order', function () {

    it('CURVE.P - curve.p is the secp256k1 field prime', function () {
      expect(BN.isBN(Curve.p)).to.be.true;
      expect(Curve.p.toString(16)).to.equal(SECP_P);
    });

    it('CURVE.P.BITLENGTH - curve.p has 256 bits', function () {
      expect(Curve.p.bitLength()).to.equal(256);
    });

    it('CURVE.N - curve.n is the secp256k1 group order', function () {
      expect(BN.isBN(Curve.n)).to.be.true;
      expect(Curve.n.toString(16)).to.equal(SECP_N);
    });

    it('CURVE.N.BITLENGTH - curve.n has 256 bits', function () {
      expect(Curve.n.bitLength()).to.equal(256);
    });

    it('CURVE.N_LT_P - group order n is strictly less than field prime p', function () {
      expect(Curve.n.cmp(Curve.p)).to.be.lessThan(0);
    });
  });

  // -----------------------------------------------------------------
  // 3.2 Curve Equation Parameters (y² = x³ + ax + b)
  // -----------------------------------------------------------------
  describe('3.2 Curve Equation Parameters', function () {

    it('CURVE.A - curve.a is 0 (secp256k1 is y² = x³ + 7)', function () {
      const aRed = Curve.a;
      expect(BN.isBN(aRed)).to.be.true;
      expect(aRed.fromRed().cmpn(0)).to.equal(0);
    });

    it('CURVE.B - curve.b is 7', function () {
      const bRed = Curve.b;
      expect(BN.isBN(bRed)).to.be.true;
      expect(bRed.fromRed().cmpn(7)).to.equal(0);
    });

    // NOTE: elliptic does not expose Curve.h (cofactor). The conf.h is passed in
    // curve options but never stored in BaseCurve. This test is omitted to match
    // the source package's behavior.

    it('CURVE.TYPE - curve.type is "short" (ShortWeierstrass)', function () {
      expect(Curve.type).to.equal('short');
    });
  });

  // -----------------------------------------------------------------
  // 3.3 Generator Point
  // -----------------------------------------------------------------
  describe('3.3 Generator Point', function () {

    it('CURVE.G - curve.g exists and is a Point', function () {
      expect(Curve.g).to.exist;
      expect(Curve.g.isInfinity()).to.be.false;
    });

    it('CURVE.G.X - curve.g.x matches the BIP-specified X coordinate', function () {
      expect(Curve.g.getX().toString(16)).to.equal(SECP_G_X);
    });

    it('CURVE.G.Y - curve.g.y matches the BIP-specified Y coordinate', function () {
      expect(Curve.g.getY().toString(16)).to.equal(SECP_G_Y);
    });

    it('CURVE.G.ON_CURVE - curve.validate(g) confirms G lies on the curve', function () {
      expect(Curve.validate(Curve.g)).to.be.true;
    });

  });

  // -----------------------------------------------------------------
  // 3.4 Red (Montgomery) Context and Internal Constants
  // -----------------------------------------------------------------
  describe('3.4 Montgomery Context and Internal Constants', function () {

    it('CURVE.RED - curve.red is a defined BN red context', function () {
      expect(Curve.red).to.exist;
      expect(Curve.red).to.not.be.null;
    });

    it('CURVE.RED.USABLE - curve.red can perform modular arithmetic', function () {
      // Verify the red context is functional using Curve.one (which is already in red form)
      // BN.one does not exist in the source BN module; Curve.one is created by BaseCurve
      const oneBack = Curve.one.fromRed();
      expect(oneBack.cmpn(1)).to.equal(0);
    });

    it('CURVE.ZERO - curve.zero is BN(0) in Montgomery form', function () {
      expect(Curve.zero).to.exist;
      expect(Curve.zero.red).to.equal(Curve.red);
      expect(Curve.zero.fromRed().cmpn(0)).to.equal(0);
    });

    it('CURVE.ONE - curve.one is BN(1) in Montgomery form', function () {
      expect(Curve.one).to.exist;
      expect(Curve.one.red).to.equal(Curve.red);
      expect(Curve.one.fromRed().cmpn(1)).to.equal(0);
    });

    it('CURVE.TWO - curve.two is BN(2) in Montgomery form', function () {
      expect(Curve.two).to.exist;
      expect(Curve.two.red).to.equal(Curve.red);
      expect(Curve.two.fromRed().cmpn(2)).to.equal(0);
    });

    it('CURVE.ZEROA - zeroA is true (a = 0 enables endomorphism optimizations)', function () {
      expect(Curve.zeroA).to.be.true;
    });

    it('CURVE.THREEA - threeA is false (a = 0, not -3 mod p)', function () {
      expect(Curve.threeA).to.be.false;
    });
  });

  // -----------------------------------------------------------------
  // 3.5 Endomorphism Configuration
  // -----------------------------------------------------------------
  describe('3.5 Endomorphism Configuration', function () {

    it('CURVE.ENDO - curve.endo exists (secp256k1 has endomorphism)', function () {
      expect(Curve.endo).to.exist;
      expect(Curve.endo).to.not.be.null;
    });

    it('CURVE.ENDO.BETA - endo.beta is defined and non-trivial (beta ≠ 1)', function () {
      const beta = Curve.endo.beta;
      expect(BN.isBN(beta)).to.be.true;
      const betaPlain = beta.fromRed();
      expect(betaPlain.cmpn(1)).to.not.equal(0);
    });

    it('CURVE.ENDO.BETA.VALID - endo.beta fromRed matches expected value', function () {
      const beta = Curve.endo.beta.fromRed();
      // The secp256k1 beta values are the two non-trivial cubic roots of unity mod p
      expect(beta.toString(16)).to.be.oneOf([
        '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
        '851695d49a83f8ef919bb86153cbcb16630fb68aed0a766a3ec693d68e6afa40'
      ]);
    });

    it('CURVE.ENDO.LAMBDA - endo.lambda is defined and non-trivial (lambda ≠ 1)', function () {
      const lambda = Curve.endo.lambda;
      expect(BN.isBN(lambda)).to.be.true;
      expect(lambda.cmpn(1)).to.not.equal(0);
    });

    it('CURVE.ENDO.LAMBDA.IDENTITY - lambda * G and (beta * Gx, Gy) match known lambdaG', function () {
      // Endomorphism identity: lambda * P = (beta * Px, Py)
      const lambda = Curve.endo.lambda;
      const beta = Curve.endo.beta;
      const g = Curve.g;

      expect(lambda.toString(16, 64)).to.equal(vectors.LAMBDA);
      expect(beta.fromRed().toString(16, 64)).to.equal(vectors.BETA);

      const lambdaG = g.mul(lambda);
      const betaMappedG = Curve.point(g.x.redMul(beta), g.y);

      expect(lambdaG.eq(betaMappedG)).to.be.true;
      expect(Curve.validate(betaMappedG)).to.be.true;
      expectPointMatchesVector(lambdaG, vectors.LAMBDA_G);
      expectPointMatchesVector(betaMappedG, vectors.LAMBDA_G);
    });

    it('CURVE.ENDO.BASIS - endo.basis has 2 vectors', function () {
      expect(Curve.endo.basis).to.be.an('array');
      expect(Curve.endo.basis.length).to.equal(2);
    });

    it('CURVE.ENDO.BASIS.VECTORS - each basis vector has integer a and b components', function () {
      const basis = Curve.endo.basis;
      for (const vec of basis) {
        expect(BN.isBN(vec.a)).to.be.true;
        expect(BN.isBN(vec.b)).to.be.true;
      }
    });

    it('CURVE.ENDO.BASIS.EQUATION - basis a + b * lambda ≡ 0 (mod n)', function () {
      // Each basis vector (a, b) satisfies: a + b * lambda ≡ 0 (mod n)
      // This means lambda * b ≡ -a (mod n), i.e. lambda is a ratio derived from the basis
      const basis = Curve.endo.basis;
      const lambda = Curve.endo.lambda;
      const n = Curve.n;

      for (const vec of basis) {
        const result = vec.a.add(vec.b.mul(lambda)).umod(n);
        expect(result.cmpn(0)).to.equal(0,
          'basis vector (' + vec.a.toString(16) + ',' + vec.b.toString(16) +
          ') does not satisfy a + b*lambda ≡ 0 (mod n)');
      }
    });

    it('CURVE.ENDO.BASIS.POSITIVE - basis vectors have non-negative a components', function () {
      // The _getEndoBasis normalizes basis vectors to have positive a
      const basis = Curve.endo.basis;
      for (const vec of basis) {
        expect(vec.a.negative).to.equal(0);
      }
    });
  });

  // NOTE: _endoSplit tests were moved to short.js Section 4.5 (SHORT.ENDO.SPLIT,
  // SHORT.ENDO.SPLIT_SMALL, SHORT.ENDO.SPLIT_EFFICIENCY) to avoid duplication.
  // CURVE.ENDO.BETA.CUBIC was moved to Part 3 (ENDO.BETA_CUBIC).
  // CURVE.G.ORDER was delegated to Part 2 (P.MUL.G_BY_N).

  // -----------------------------------------------------------------
  // 3.9 Bit Length and Curve Properties
  // -----------------------------------------------------------------
  describe('3.9 Bit Length and Derived Properties', function () {

    it('CURVE._BITLENGTH - curve._bitLength matches secp256k1 order bit length', function () {
      expect(Curve._bitLength).to.equal(256);
    });

    it('CURVE.P.MODN3 - p mod 3 === 1 (required for endomorphism)', function () {
      expect(Curve.p.modn(3)).to.equal(1);
    });
  });
});
