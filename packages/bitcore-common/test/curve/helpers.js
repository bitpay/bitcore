/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { Curve } = require('../../');
const vectors = require('../data/secp256k1-vectors');

const SECP_P = vectors.P;
const SECP_N = vectors.N;
const SECP_N_MINUS_1 = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140';
const SECP_N_MINUS_2 = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd036413f';
const SECP_G_X = vectors.G_X;
const SECP_G_Y = vectors.G_Y;
const SECP_2G_X = vectors.KG['0x2'].x;
const SECP_2G_Y = vectors.KG['0x2'].y;
const P_BYTE_LENGTH = 32;

function isOnCurve(pt) {
  if (pt.isInfinity()) return true;
  return Curve.validate(pt);
}

function isOnCurveJ(jp) {
  return isOnCurve(jp.toP());
}

function pad64(s) {
  return s.padStart(64, '0');
}

module.exports = {
  isOnCurve,
  isOnCurveJ,
  pad64,
  P_BYTE_LENGTH,
  SECP_P,
  SECP_N,
  SECP_N_MINUS_1,
  SECP_N_MINUS_2,
  SECP_G_X,
  SECP_G_Y,
  SECP_2G_X,
  SECP_2G_Y
};
