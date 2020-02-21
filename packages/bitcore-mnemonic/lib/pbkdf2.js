'use strict';

var crypto = require("crypto");

/**
 * PDKBF2
 * Credit to: https://github.com/stayradiated/pbkdf2-sha512
 * Copyright (c) 2014, JP Richardson Copyright (c) 2010-2011 Intalio Pte, All Rights Reserved
 */
function pbkdf2(key, salt, iterations, dkLen) {
  /* jshint maxstatements: 31 */
  /* jshint maxcomplexity: 9 */

  var hLen = 64; //SHA512 Mac length
  if (dkLen > (Math.pow(2, 32) - 1) * hLen) {
    throw Error('Requested key length too long');
  }

  if (typeof key !== 'string' && !Buffer.isBuffer(key)) {
    throw new TypeError('key must a string or Buffer');
  }

  if (typeof salt !== 'string' && !Buffer.isBuffer(salt)) {
    throw new TypeError('salt must a string or Buffer');
  }

  if (typeof key === 'string') {
    key = Buffer.from(key);
  }

  if (typeof salt === 'string') {
    salt = Buffer.from(salt);
  }

  var DK = Buffer.alloc(dkLen);

  var U = Buffer.alloc(hLen);
  var T = Buffer.alloc(hLen);
  var block1 = Buffer.alloc(salt.length + 4);

  var l = Math.ceil(dkLen / hLen);
  var r = dkLen - (l - 1) * hLen;

  salt.copy(block1, 0, 0, salt.length);
  for (var i = 1; i <= l; i++) {
    block1[salt.length + 0] = (i >> 24 & 0xff);
    block1[salt.length + 1] = (i >> 16 & 0xff);
    block1[salt.length + 2] = (i >> 8  & 0xff);
    block1[salt.length + 3] = (i >> 0  & 0xff);

    U = crypto.createHmac('sha512', key).update(block1).digest();

    U.copy(T, 0, 0, hLen);

    for (var j = 1; j < iterations; j++) {
      U = crypto.createHmac('sha512', key).update(U).digest();

      for (var k = 0; k < hLen; k++) {
        T[k] ^= U[k];
      }
    }

    var destPos = (i - 1) * hLen;
    var len = (i === l ? r : hLen);
    T.copy(DK, destPos, 0, len);
  }

  return DK;
}

module.exports = pbkdf2;
