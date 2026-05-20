'use strict';
import ShortCurve from './short.js';
import { assert } from '../utils.js';

const curve = new ShortCurve({
  p: 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  n: 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  g: ['79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'],
  a: 0,
  b: 7,
  h: 1
});

export default curve;
export { assert };
