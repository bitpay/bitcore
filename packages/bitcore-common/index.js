'use strict';

/**
 * bitcore-common — crypto primitives for bitcore packages.
 *
 * API Contract:
 * - All functions accept private keys as Buffer (32 bytes), NOT strings.
 * - Public keys are returned as Point objects or Buffer (32 bytes for x-only).
 */
export { default as BN } from './lib/bn.js';
export { default as Curve } from './lib/curve/secp256k1.js';
export * as Utils from './lib/utils.js';
export { default as Point } from './lib/curve/short.js';
