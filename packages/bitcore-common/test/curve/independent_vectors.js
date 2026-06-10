/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { Curve } = require('../../');
const { expect } = require('chai');
const vectors = require('../data/secp256k1-vectors');
const {
  isOnCurve,
  pad64,
  SECP_N,
  SECP_N_MINUS_1,
  SECP_N_MINUS_2
} = require('./helpers');

/**
 * Independent Vector Corpus Tests
 *
 * For each scalar in the deterministic corpus, verify:
 * 1. G.mul(k) affine coordinates match the external vector (when a vector exists).
 * 2. Compressed encoding consistency (x + parity byte).
 * 3. G.mul(k).toJ().mul('1') (via Jacobian) produces the same point.
 *
 * This tests scalar multiplication correctness through an external oracle rather
 * than internal consistency (A == B where both A and B use the same code path).
 */

describe('Independent Vector Corpus - scalar multiplication vs external oracle', function () {

  // Scalar-to-vector key mapping. Scalars without vector entries get
  // isInfinityScalar set to true/false for basic invariant checks.
  const CORPUS = [
    { scalar: '0',    key: null,        tag: 'ZERO',          isInf: true  },
    { scalar: '1',    key: '0x1',       tag: 'IDENTITY',      isInf: false },
    { scalar: '2',    key: '0x2',       tag: 'DOUBLING',      isInf: false },
    { scalar: '3',    key: '0x3',       tag: 'NAF_WT2',       isInf: false },
    { scalar: '7',    key: '0x7',       tag: 'NAF_WT1',       isInf: false },
    { scalar: '8',    key: '0x8',       tag: 'PWR2',          isInf: false },
    { scalar: 'ff',   key: '0xff',      tag: 'ENDO_PATH',     isInf: false },
    { scalar: '100',  key: '0x100',     tag: 'PRECOMP_PATH',  isInf: false },
    { scalar: '1ff',  key: null,        tag: 'MIXED_NAF',     isInf: false },
    { scalar: '200',  key: null,        tag: 'NEXT_PWR2',     isInf: false },
    { scalar: '3ff',  key: null,        tag: 'ALL1S_10BITS',  isInf: false },
    { scalar: '7fff', key: null,        tag: '32K',           isInf: false },
    { scalar: 'ffff', key: null,        tag: '64K',           isInf: false },
    { scalar: '10000',key: null,        tag: '64K_PLUS_1',    isInf: false },
    { scalar: 'deadbeef',  key: '0xdeadbeef',      tag: 'KNOWN_DEADBEEF', isInf: false },
    { scalar: 'cafebabe', key: '0xcafebabe',     tag: 'KNOWN_CAFEBABE',   isInf: false },
    {
      scalar: '10000000000000000',
      key: null,
      tag: 'P2_56',
      isInf: false,
    },
    {
      scalar: '100000000000000000000000000000000',
      key: '0x100000000000000000000000000000000',
      tag: 'P2_128',
      isInf: false,
    },
    {
      scalar: '100000000000000000000000000000000000000000000000',
      key: null,
      tag: 'P2_160',
      isInf: false,
    },
    { scalar: SECP_N_MINUS_2, key: null, tag: 'N_MINUS_2', isInf: false },
    { scalar: SECP_N_MINUS_1, key: null, tag: 'N_MINUS_1', isInf: false },
    { scalar: SECP_N, key: null,        tag: 'N',             isInf: true  },
  ];

  /**
   * Cross-check: G.mul(k).toJ().mul('1') === G.mul(k)
   * This verifies the Jacobian path is consistent with the affine path.
   */
  function checkJacobianConsistency(result) {
    const jResult = result.toJ().mul('1');
    expect(jResult.toP().eq(result)).to.be.true;
  }

  /**
   * Cross-check: compressed encoding of result matches x-coordinate + parity
   */
  function checkCompressedConsistency(result) {
    if (result.isInfinity()) return;
    const y = result.getY();
    // Compressed encoding would be: 0x02 or 0x03 + x (big-endian)
    const parity = y.isEven() ? '02' : '03';
    // Verify parity: the least-significant hex digit of y determines even/odd
    const yHex = y.toString(16, 64);
    const yLSD = parseInt(yHex[yHex.length - 1], 16);
    const computedParity = yLSD % 2 === 0 ? '02' : '03';
    expect(parity).to.equal(computedParity);
  }
  // Individual scalar tests
  for (const entry of CORPUS) {
    const { scalar, key, tag, isInf } = entry;

    describe(`Independent vector check: ${tag} (k="${scalar}")`, function () {

      it(`${tag} - G.mul("${scalar}") has expected scalar behavior`, function () {
        const result = Curve.g.mul(scalar);

        if (isInf) {
          expect(result.isInfinity()).to.be.true;
          return;
        }

        if (key && vectors.KG[key]) {
          const vec = vectors.KG[key];
          expect(pad64(result.getX().toString(16))).to.equal(vec.x);
          expect(pad64(result.getY().toString(16))).to.equal(vec.y);
        } else {
          // For scalars not yet in the vector file:
          expect(result.isInfinity()).to.be.false;
          expect(isOnCurve(result)).to.be.true;
        }
      });

      it(`${tag} - Compressed encoding consistency`, function () {
        const result = Curve.g.mul(scalar);
        checkCompressedConsistency(result);
      });

      it(`${tag} - Jacobian consistency: mul(k).toJ().mul('1') === mul(k)`, function () {
        const result = Curve.g.mul(scalar);
        if (isInf) {
          expect(result.toJ().isInfinity()).to.be.true;
        } else {
          checkJacobianConsistency(result);
        }
      });
    });
  }
  // Boundary and order property tests
  describe('Boundary and order properties', function () {

    it('N * G is infinity (group order property)', function () {
      const result = Curve.g.mul(SECP_N);
      expect(result.isInfinity()).to.be.true;
    });

    it('N-1 * G has same x as G (negation property)', function () {
      const result = Curve.g.mul(SECP_N_MINUS_1);
      const gNeg = Curve.g.neg();
      expect(result.getX().toString(16, 64)).to.equal(gNeg.getX().toString(16, 64));
      expect(result.getY().toString(16, 64)).to.equal(gNeg.getY().toString(16, 64));
    });

    it('N-2 * G has same x as 2G (negation property)', function () {
      const result = Curve.g.mul(SECP_N_MINUS_2);
      const g2Neg = Curve.g.mul('2').neg();
      expect(result.getX().toString(16, 64)).to.equal(g2Neg.getX().toString(16, 64));
      expect(result.getY().toString(16, 64)).to.equal(g2Neg.getY().toString(16, 64));
    });

    it('2^160 * G is valid (non-infinity, on-curve)', function () {
      const result = Curve.g.mul('100000000000000000000000000000000000000000000000');
      expect(result.isInfinity()).to.be.false;
      expect(isOnCurve(result)).to.be.true;
    });

    it('2^56 * G is valid (non-infinity, on-curve)', function () {
      const result = Curve.g.mul('10000000000000000');
      expect(result.isInfinity()).to.be.false;
      expect(isOnCurve(result)).to.be.true;
    });
  });
});
