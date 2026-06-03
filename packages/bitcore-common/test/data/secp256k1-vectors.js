 
'use strict';

/**
 * Canonical secp256k1 test vectors.
 *
 * These coordinates are independently verifiable and must not be computed
 * via the library's own multiplication/doubling code. They serve as an
 * independent oracle for correctness testing.
 *
 * Sources:
 *   - SECG SECP256K1 specification (secg.org)
 *   - IETF draft-irtf-cfrg-secp256k1
 *   - bitcoin-core secp256k1 test vectors
 *   - OpenTimestamps reference implementation
 *
 * Scalar multiples were computed once and hard-coded here.
 * This file is secp256k1-specific (the library's Curve is hardcoded to
 * secp256k1 in lib/index.js).
 */

// ---------------------------------------------------------------------------
// Curve parameters
// ---------------------------------------------------------------------------

/** Prime field modulus p */
exports.P =
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f';

/** Group order n */
exports.N =
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';

/** Endomorphism parameter β (beta) such that β³ = 1 (mod p), β ≠ 1 */
exports.BETA =
  '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee';

/** Endomorphism parameter λ (lambda) such that λ³ = 1 (mod n), λ ≠ 1 */
exports.LAMBDA =
  '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72';

// ---------------------------------------------------------------------------
// Generator point G
// ---------------------------------------------------------------------------

/** Generator x-coordinate */
exports.G_X =
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

/** Generator y-coordinate */
exports.G_Y =
  '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';

// ---------------------------------------------------------------------------
// Known scalar multiples of G  (k * G)
//
// These values are used as independent oracles in correctness tests.
// A test that computes k*G via the library and compares against these
// vectors verifies correctness independently of the multiplication code
// path being tested.
// ---------------------------------------------------------------------------

exports.KG = {
  // Small integers — cross-checked against SECG / IETF test vectors
  '1': {
    x: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    y: '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
  },
  '2': {
    x: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    y: '1ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a',
  },
  '3': {
    x: 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
    y: '388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672',
  },
  '4': {
    x: 'e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13',
    y: '51ed993ea0d455b75642e2098ea51448d967ae33bfbdfe40cfe97bdc47739922',
  },
  '5': {
    x: '2f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4',
    y: 'd8ac222636e5e3d6d4dba9dda6c9c426f788271bab0d6840dca87d3aa6ac62d6',
  },
  '6': {
    x: 'fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556',
    y: 'ae12777aacfbb620f3be96017f45c560de80f0f6518fe4a03c870c36b075f297',
  },
  '7': {
    x: '5cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc',
    y: '6aebca40ba255960a3178d6d861a54dba813d0b813fde7b5a5082628087264da',
  },
  '8': {
    x: '2f01e5e15cca351daff3843fb70f3c2f0a1bdd05e5af888a67784ef3e10a2a01',
    y: '5c4da8a741539949293d082a132d13b4c2e213d6ba5b7617b5da2cb76cbde904',
  },
  '10': {
    x: 'a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7',
    y: '893aba425419bc27a3b6c7e693a24c696f794c2ed877a1593cbee53b037368d7',
  },
  '13': {
    x: 'f28773c2d975288bc7d1d205c3748651b075fbc6610e58cddeeddf8f19405aa8',
    y: '0ab0902e8d880a89758212eb65cdaf473a1a06da521fa91f29b5cb52db03ed81',
  },
  '14': {
    x: '499fdf9e895e719cfd64e67f07d38e3226aa7b63678949e6e49b241a60e823e4',
    y: 'cac2f6c4b54e855190f044e4a7b3d464464279c27a3f95bcc65f40d403a13f5b',
  },
  '99': {
    x: 'e22fbe15c0af8ccc5780c0735f84dbe9a790badee8245c06c7ca37331cb36980',
    y: '0a855babad5cd60c88b430a69f53a1a7a38289154964799be43d06d77d31da06',
  },
  '255': {
    x: '1b38903a43f7f114ed4500b4eac7083fdefece1cf29c63528d563446f972c180',
    y: '4036edc931a60ae889353f77fd53de4a2708b26b6f5da72ad3394119daf408f9',
  },
  '508': {
    x: '7a6dde243e278c95a9ab2130bdc4870af7136fc937924c39678fb8f58ae63078',
    y: '4094b8ac751a063007749050c003eed6526b3399149c3a74b1c7b6d69be933f5',
  },

  // Large scalars used in arith-paths.js internal multiplication tests
  '0xdeadbeef': {
    x: '76d2fdf1302d1fa9556f4df94ec84cefba6d482e54f47c6c2a238c1baa560f0e',
    y: 'b754ac7e7a3e09c44184cb451a4f5fb557f32053eb015dffebb655b5cfd54d8a',
  },
  '0xdeadbeefdeadbeefdeadbeefdeadbeef': {
    x: 'a69bb7d550cce403895d3c36f8a358fbb333c76300c77c33c0f0fcfe6836b39f',
    y: 'bf9e86abde150d4791c07e673e85c9983f1d681ebf44b8ac688982081c527c08',
  },
  '0xcafebabe': {
    x: 'dd285e29fbd0d853699087b48ef44607cb791a7ddc4392ef82c571b11f6a922f',
    y: '9a7fe2ef963a641828209c6aa2a12036298f00cc296ef4501afd408d6f66ab38',
  },
  '2^128': {
    x: '8f68b9d2f63b5f339239c1ad981f162ee88c5678723ea3351b7b444c9ec4c0da',
    y: '662a9f2dba063986de1d90c2b6be215dbbea2cfe95510bfdf23cbf79501fff82',
  },
};

// ---------------------------------------------------------------------------
// Derived values (negated points)
//
// Negation in secp256k1: (x, -y) = (x, p - y)
// The x-coordinate stays the same; the y-coordinate is reflected about p/2.
// ---------------------------------------------------------------------------

/**
 * Returns the negated y-coordinate for a given point.
 * (x, p - y) is the negation of (x, y) on secp256k1.
 *
 * @param {string} yHex - y-coordinate as hex string
 * @returns {string}  - negated y as hex string (64 chars, zero-padded)
 */
exports.negY = function negY(yHex) {
  const BN = require('../../lib/bn');
  const p = new BN(exports.P, 16);
  const y = new BN(yHex, 16);
  const negY = p.sub(y);
  return negY.toString(16, 64);
};

/** Negated 2G — same x as 2G, y = p - SECP_2G_Y */
exports.NEG_2G_X = exports.KG['2'].x;
exports.NEG_2G_Y = exports.negY(exports.KG['2'].y);
