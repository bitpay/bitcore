'use strict';
import { assert } from '../utils.js';
import ShortCurve from './short.js';

const curve = new ShortCurve({
  prime: 'k256',
  p: 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  n: 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  g: ['79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'],
  a: 0,
  b: 7,
  beta: '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
  lambda: '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72',
  basis: [
    {
      a: '3086d221a7d46bcde86c90e49284eb15',
      b: '-e4437ed6010e88286f547fa90abfe4c3'
    },
    {
      a: '114ca50f7a8e2f3f657c1108d9d44cfd8',
      b: '3086d221a7d46bcde86c90e49284eb15'
    }
  ]
});

curve.g.precompute(curve.n.bitLength() + 1);

export default curve;
export { assert };
