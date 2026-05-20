'use strict';

import { Buffer } from 'buffer';

import BN from './bn.js';
import curve from './curve/secp256k1.js';

const pointPrototype = Object.getPrototypeOf(curve.point(
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'
));
const protoGetX = pointPrototype.getX;
const protoGetY = pointPrototype.getY;

/**
 * Instantiate a valid secp256k1 Point from the X and Y coordinates.
 *
 * @param {BN|String} x - The X coordinate
 * @param {BN|String} y - The Y coordinate
 * @param {Boolean} isRed - Whether x and y are in Montgomery form
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of Point
 * @constructor
 */
function Point(x, y, isRed) {
  let point;
  try {
    point = curve.point(x, y, isRed);
  } catch (e) {
    throw new Error('Invalid Point');
  }
  point.validate();
  return point;
}

Point.prototype = pointPrototype;

/**
 * Instantiate a valid secp256k1 Point from only the X coordinate
 *
 * @param {boolean} odd - If the Y coordinate is odd
 * @param {BN|String} x - The X coordinate
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of Point
 */
Point.fromX = function fromX(odd, x) {
  let point;
  try {
    point = curve.pointFromX(x, odd);
  } catch (e) {
    throw new Error('Invalid X');
  }
  point.validate();
  return point;
};

/**
 * Will return a secp256k1 ECDSA base point.
 * @returns {Point} An instance of the base point.
 */
Point.getG = function getG() {
  return curve.g;
};

/**
 * Will return the max of range of valid private keys as governed by the secp256k1 ECDSA standard.
 * @returns {BN} A BN instance of the number of points on the curve
 */
Point.getN = function getN() {
  return new BN(curve.n.toArray());
};

/**
 * Secp256k1 field size
 * @returns {BN} A BN instance of the field size
 */
Point.getP = function getP() {
  return curve.p.clone();
};

/**
 * Will return the X coordinate of the Point
 * @returns {BN} A BN instance of the X coordinate
 */
Point.prototype.getX = function getX() {
  return new BN(this._getX().toArray());
};

/**
 * Will return the Y coordinate of the Point
 * @returns {BN} A BN instance of the Y coordinate
 */
Point.prototype.getY = function getY() {
  return new BN(this._getY().toArray());
};

/**
 * Will determine if the point is valid
 *
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of the same Point
 */
Point.prototype.validate = function validate() {
  if (this.isInfinity()) {
    throw new Error('Point cannot be equal to Infinity');
  }

  let p2;
  try {
    p2 = curve.pointFromX(this.getX(), this.getY().isOdd());
  } catch (e) {
    throw new Error('Point does not lie on the curve');
  }

  if (p2.y.cmp(this.y) !== 0) {
    throw new Error('Invalid y value for curve.');
  }

  if (!(this.mul(Point.getN()).isInfinity())) {
    throw new Error('Point times N must be infinity');
  }

  return this;
};

/**
 * Convert a point to a compressed Buffer
 */
Point.pointToCompressed = function pointToCompressed(point) {
  const xbuf = point.getX().toBuffer({ size: 32 });
  const ybuf = point.getY().toBuffer({ size: 32 });

  const odd = ybuf[ybuf.length - 1] % 2;
  const prefix = Buffer.from([odd ? 0x03 : 0x02]);
  return Buffer.concat([prefix, xbuf]);
};

/**
 * Lift an x-coordinate to a full point on the curve.
 * @returns {Point}
 */
Point.prototype.liftX = function () {
  const pointX = this.x.red ? this.x.fromRed() : this.x;
  return Point.fromX(false, pointX);
};

// Store references to original prototype methods before overriding
Object.defineProperty(Point.prototype, '_getX', { value: protoGetX });
Object.defineProperty(Point.prototype, '_getY', { value: protoGetY });

export default Point;
