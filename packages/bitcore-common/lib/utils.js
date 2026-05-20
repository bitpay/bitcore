'use strict';

import BN from './bn.js';

export const assert = function assert (cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
};
export const toArray = function toArray (str, encoding) {
  if (typeof str === 'string') {
    if (encoding === 'hex') return hexToArray(str);
    return Array.prototype.slice.call(str, 0);
  }
  return str;
};
function hexToArray (hex) {
  const arr = new Array(hex.length / 2);
  for (let i = 0; i < hex.length; i++) arr[i] = parseInt(hex[i * 2] + hex[i * 2 + 1], 16);
  return arr;
}
export const zero2 = function zero2 (str) {
  if (str.length % 2) str = '0' + str;
  return str;
};
export const toHex = function toHex (buf) {
  let hex = '';
  for (let i = 0; i < buf.length; i++) hex += zero2(buf[i].toString(16));
  return hex;
};
export const encode = function encode (arr, enc) {
  if (enc === 'hex')
    return toHex(arr);
  return arr;
};

// Represent num in a w-NAF form
export function getNAF (num, w, bits) {
  const naf = new Array(Math.max(num.bitLength(), bits) + 1);
  naf.fill(0);

  const ws = 1 << (w + 1);
  const k = num.clone();

  for (let i = 0; i < naf.length; i++) {
    var z;
    const mod = k.andln(ws - 1);
    if (k.isOdd()) {
      if (mod > (ws >> 1) - 1)
        z = (ws >> 1) - mod;
      else
        z = mod;
      k.isubn(z);
    } else {
      z = 0;
    }

    naf[i] = z;
    k.iushrn(1);
  }

  return naf;
}

// Represent k1, k2 in a Joint Sparse Form
export function getJSF (k1, k2) {
  const jsf = [
    [],
    []
  ];

  k1 = k1.clone();
  k2 = k2.clone();
  let d1 = 0;
  let d2 = 0;
  while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {

    // First phase
    let m14 = (k1.andln(3) + d1) & 3;
    let m24 = (k2.andln(3) + d2) & 3;
    if (m14 === 3)
      m14 = -1;
    if (m24 === 3)
      m24 = -1;
    var u1;
    if ((m14 & 1) === 0) {
      u1 = 0;
    } else {
      var m8 = (k1.andln(7) + d1) & 7;
      if ((m8 === 3 || m8 === 5) && m24 === 2)
        u1 = -m14;
      else
        u1 = m14;
    }
    jsf[0].push(u1);

    var u2;
    if ((m24 & 1) === 0) {
      u2 = 0;
    } else {
      var m8 = (k2.andln(7) + d2) & 7;
      if ((m8 === 3 || m8 === 5) && m14 === 2)
        u2 = -m24;
      else
        u2 = m24;
    }
    jsf[1].push(u2);

    // Second phase
    if (2 * d1 === u1 + 1)
      d1 = 1 - d1;
    if (2 * d2 === u2 + 1)
      d2 = 1 - d2;
    k1.iushrn(1);
    k2.iushrn(1);
  }

  return jsf;
}

export const cachedProperty = function cachedProperty (obj, name, computer) {
  const key = '_' + name;
  obj.prototype[name] = function cachedProperty () {
    return this[key] !== undefined ? this[key] :
      this[key] = computer.call(this);
  };
};

export const parseBytes = function parseBytes (bytes) {
  return typeof bytes === 'string' ? toArray(bytes, 'hex') :
    bytes;
};

export const intFromLE = function intFromLE (bytes) {
  return new BN(bytes, 'hex', 'le');
};
