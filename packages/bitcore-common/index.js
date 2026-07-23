'use strict';

/**
 * bitcore-common — crypto primitives for bitcore packages.
 *
 * API Contract:
 * - All functions accept private keys as Buffer (32 bytes), NOT strings.
 * - Public keys are returned as Point objects or Buffer (32 bytes for x-only).
 */
const BN = require('./lib/bn');
const Curve = require('./lib/curve/secp256k1');
const { Point } = require('./lib/curve/point');
const Utils = require('./lib/utils');

module.exports.BN = BN;
module.exports.Curve = Curve;
module.exports.Point = Point;
module.exports.Utils = Utils;

