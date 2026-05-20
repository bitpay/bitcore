'use strict';

/**
 * bitcore-common — crypto primitives for bitcore packages.
 *
 * API Contract:
 * - All functions accept private keys as Buffer (32 bytes), NOT strings.
 * - Public keys are returned as Point objects or Buffer (32 bytes for x-only).
 */
module.exports = {
  BN: require('./lib/bn'),
  Utils: require('./lib/utils'),
  Curve: require('./lib/curve/secp256k1'),
  Point: require('./lib/curve/short').Point,
  Random: require('./lib/random'),
};
