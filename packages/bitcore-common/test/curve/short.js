/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve } = require('../../');
const { expect } = require('chai');

// secp256k1 constants (BN hex strings)
const SECP_P = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f';
const SECP_G_X = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SECP_G_Y = '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';

describe('ShortWeierstrass Curve Operations', function () {

  // -----------------------------------------------------------------
  // 4.1 Point Factory Methods
  // -----------------------------------------------------------------
  describe('4.1 Point Factory Methods', function () {

    it('SHORT.POINT - curve.point(x, y) creates an affine Point with matching coordinates', function () {
      const pt = Curve.point(SECP_G_X, SECP_G_Y);
      expect(pt).to.exist;
      expect(pt.type).to.equal('affine');
      expect(pt.isInfinity()).to.be.false;
      expect(pt.getX().toString(16)).to.equal(SECP_G_X);
      expect(pt.getY().toString(16)).to.equal(SECP_G_Y);
    });

    it('SHORT.POINT.INFINITY - curve.point(null, null) creates point at infinity', function () {
      const inf = Curve.point(null, null);
      expect(inf).to.exist;
      expect(inf.isInfinity()).to.be.true;
    });

    it('SHORT.POINT.JPOINT - toJ() creates a JPoint with zOne', function () {
      const jpt = Curve.g.toJ();
      expect(jpt).to.exist;
      expect(jpt.type).to.equal('jacobian');
      expect(jpt.zOne).to.be.true;
    });

    it('SHORT.POINT.JPOINT.INFINITY - curve.jpoint(null, null, null) creates infinity JPoint', function () {
      const jinf = Curve.jpoint(null, null, null);
      expect(jinf).to.exist;
      expect(jinf.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 4.2 Point Validation (curve.validate)
  // -----------------------------------------------------------------
  describe('4.2 Curve Point Validation', function () {

    it('SHORT.VALIDATE.G - curve.validate(G) returns true (generator is on curve)', function () {
      expect(Curve.validate(Curve.g)).to.be.true;
    });

    it('SHORT.VALIDATE.2G - curve.validate(2G) returns true (any valid point)', function () {
      const twoG = Curve.g.dbl();
      expect(Curve.validate(twoG)).to.be.true;
    });

    it('SHORT.VALIDATE.INF - curve.validate(point-at-infinity) returns true', function () {
      const inf = Curve.point(null, null);
      expect(Curve.validate(inf)).to.be.true;
    });

    it('SHORT.VALIDATE.OFF_CURVE - random off-curve point fails validation', function () {
      // x=1, y=2: y²=4, x³+7=8, 4≠8 mod p => off curve
      const offCurve = Curve.point('1', '2');
      expect(Curve.validate(offCurve)).to.be.false;
    });
  });

  // -----------------------------------------------------------------
  // 4.3 Point Deserialization (pointFromJSON)
  // -----------------------------------------------------------------
  describe('4.3 Point Deserialization', function () {

    it('SHORT.POINT_FROM_JSON - pointFromJSON([x, y]) recovers a point', function () {
      const pt = Curve.pointFromJSON([SECP_G_X, SECP_G_Y]);
      expect(pt).to.exist;
      expect(pt.getX().toString(16)).to.equal(SECP_G_X);
      expect(pt.getY().toString(16)).to.equal(SECP_G_Y);
    });

    it('SHORT.POINT_FROM_JSON_PRECOMP - pointFromJSON with precomputed data preserves tables', function () {
      // Generate a point with precomputed table, serialize to JSON, then deserialize
      const G = Curve.g;
      G.precompute(8);
      const json = G.toJSON();

      // Verify the JSON has a precomputed field
      expect(json[2]).to.exist;
      expect(json[2].naf).to.exist;
      expect(json[2].doubles).to.exist;

      // Deserialize and verify coordinates match
      const recovered = Curve.pointFromJSON(json);
      expect(recovered).to.exist;
      expect(recovered.getX().toString(16)).to.equal(G.getX().toString(16));
      expect(recovered.getY().toString(16)).to.equal(G.getY().toString(16));

      // The recovered point should also have precomputed tables
      expect(recovered.precomputed).to.exist;
      expect(recovered.precomputed.naf).to.exist;
      expect(recovered.precomputed.doubles).to.exist;
    });
  });

  // -----------------------------------------------------------------
  // 4.4 Point from X Coordinate (pointFromX)
  // -----------------------------------------------------------------
  describe('4.4 Point from X Coordinate', function () {

    it('SHORT.POINT_FROM_X.G - pointFromX(Gx, false) recovers G (even-y)', function () {
      // secp256k1 generator G has an even y-coordinate
      const recovered = Curve.pointFromX(SECP_G_X, false);
      expect(recovered.getX().toString(16)).to.equal(SECP_G_X);
      expect(recovered.getY().toString(16)).to.equal(SECP_G_Y);
      expect(recovered.eq(Curve.g)).to.be.true;
    });

    it('SHORT.POINT_FROM_X.NEG_G - pointFromX(Gx, true) recovers -G (odd-y)', function () {
      const recovered = Curve.pointFromX(SECP_G_X, true);
      expect(recovered.getX().toString(16)).to.equal(SECP_G_X);
      // y coordinate should be -Gy mod p
      const negGy = Curve.g.y.redNeg().fromRed();
      expect(recovered.getY().toString(16)).to.equal(negGy.toString(16));
      expect(recovered.eq(Curve.g.neg())).to.be.true;
    });

    it('SHORT.POINT_FROM_X.EVEN - pointFromX(x, false) returns point with even y', function () {
      // Use 2G which has a known valid x
      const twoG = Curve.g.dbl();
      const recovered = Curve.pointFromX(twoG.getX().toString(16), false);
      expect(recovered.getY().isEven()).to.be.true;
      // The recovered point should be equivalent to the original
      expect(recovered.eq(twoG)).to.be.true;
    });

    it('SHORT.POINT_FROM_X.ODD - pointFromX(x, true) returns point with odd y', function () {
      const twoG = Curve.g.dbl();
      const recovered = Curve.pointFromX(twoG.getX().toString(16), true);
      expect(recovered.getY().isEven()).to.be.false;
      // The recovered point should be the negation of the original
      expect(recovered.eq(twoG.neg())).to.be.true;
    });

    it('SHORT.POINT_FROM_X.SAME_X - two roots from same x differ only by sign of y', function () {
      const gx = SECP_G_X;
      const even = Curve.pointFromX(gx, false);
      const odd = Curve.pointFromX(gx, true);
      expect(even.eq(odd.neg())).to.be.true;
      // They should have the same x
      expect(even.getX().toString(16)).to.equal(odd.getX().toString(16));
    });

    it('SHORT.POINT_FROM_X.INVALID - pointFromX with x not on curve throws', function () {
      // x=0 => y² = 0³ + 7 = 7. 7 is not a quadratic residue mod secp256k1 p.
      expect(function () {
        Curve.pointFromX('0', false);
      }).to.throw('invalid point');
    });

    it('SHORT.POINT_FROM_X.EVEN_ODD_PAIR - pointFromX(x,false) + pointFromX(x,true) = 2G (sum to zero)', function () {
      // The two points recovered from the same x should sum to infinity
      const gx = SECP_G_X;
      const even = Curve.pointFromX(gx, false);
      const odd = Curve.pointFromX(gx, true);
      const sum = even.add(odd);
      expect(sum.isInfinity()).to.be.true;
    });
  });

  // -----------------------------------------------------------------
  // 4.5 Endomorphism Scalar Split (_endoSplit)
  // -----------------------------------------------------------------
  describe('4.5 Endomorphism Scalar Split', function () {

    it('SHORT.ENDO.SPLIT - _endoSplit(k) satisfies k ≡ k1 + k2*lambda (mod n)', function () {
      // The GLV decomposition satisfies: k ≡ k1 + k2 * lambda (mod n)
      const lambda = Curve.endo.lambda;
      const n = Curve.n;

      const testScalars = [
        new BN('1', 16),
        new BN('ff', 16),
        new BN('deadbeef', 16),
        new BN('1234567890abcdef', 16),
        new BN('ffffffffffffffff', 16),
        new BN('fffffffffffffffffffffffffffffffe', 16),
        Curve.n.clone().subn(1),
      ];

      for (const k of testScalars) {
        const split = Curve._endoSplit(k);
        const reconstructed = split.k1.add(split.k2.mul(lambda)).umod(n);
        expect(reconstructed.cmp(k.umod(n))).to.equal(0,
          'k=' + k.toString(16) + ' did not reconstruct: got ' + reconstructed.toString(16));
      }
    });

    it('SHORT.ENDO.SPLIT_SMALL - _endoSplit(small k) gives k1=k, k2=0', function () {
      // For very small k, k2 should be 0 and k1 should equal k
      const k = new BN('1', 16);
      const split = Curve._endoSplit(k);
      expect(split.k1.cmp(k)).to.equal(0);
      expect(split.k2.cmpn(0)).to.equal(0);
    });

    it('SHORT.ENDO.SPLIT_SMALL2 - _endoSplit(small k=2) gives k1=2, k2=0', function () {
      const k = new BN('2', 16);
      const split = Curve._endoSplit(k);
      expect(split.k1.cmp(k)).to.equal(0);
      expect(split.k2.cmpn(0)).to.equal(0);
    });

    it('SHORT.ENDO.SPLIT_EFFICIENCY - k1 and k2 are roughly half the bit-length of k', function () {
      // The GLV decomposition should produce k1, k2 that are roughly n/2 bits
      const k = Curve.n.clone().subn(1); // near-maximum scalar
      const split = Curve._endoSplit(k);
      // k1 and k2 should each be at most ~130 bits (roughly half of 256)
      expect(split.k1.bitLength()).to.be.lessThanOrEqual(130);
      expect(split.k2.bitLength()).to.be.lessThanOrEqual(130);
    });
  });


});
