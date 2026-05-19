# Implementation Plan: bitcore-common from elliptic

Execute these steps in order. All source files are under:
`/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/`
`/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/bn.js/`

## CRITICAL: Agent Instructions — Read Before Starting

1. **NO assumptions** — if any require path, variable, or function is unclear, STOP and ask. Do not guess.
2. **Private keys MUST NEVER be represented as strings** (hex strings, decimal strings, etc.).
   - Private keys flow through `bitcore-common` exclusively as `Buffer` (32 bytes) or `BN` objects.
   - `bitcore-common`'s public API (`ECDSA.sign`, `ECDSA.verify`, `Schnorr.sign`, `Schnorr.verify`) accepts private keys as `Buffer` (raw 32-byte) — NOT strings.
   - When copying from elliptic, check every `new BN(str, 'hex')` that creates a BN from a private key / scalar — the elliptic source uses `new BN(msg, 16)` for message hashing (that's fine, it's a hash, not a key), but for key material, convert to Buffer-based APIs.
   - In `ecdsa.js`: `sign` takes `msg` and `keyPair` — the keyPair's `d` (private scalar) should be accessed via `.toBuffer()` if it enters our API, or kept as BN internally.
   - In `schnorr.js`: the `sign` function receives `privateKey` — ensure it's a `Buffer`. Do NOT accept hex string.
   - In `secp256k1.js`: curve constants (p, n, Gx, Gy) are strings — this is FINE. These are public curve parameters, not keys.
   - In `bn.js` (copied): `new BN(str, hex)` is used extensively — this is fine for PUBLIC values. Mark any usage on key material.
   - The `bitcore-common` public API should have a clear contract documented in `index.js`.
3. **Do not modify copied code beyond what's specified** — only the require fixes and inline helpers shown in each step. Everything else (including the algorithm logic) stays identical to elliptic.
4. **Execute steps in order** — steps have file dependency ordering. Do not skip ahead.
5. **After each step, verify the file exists and has the correct line count** — compare against the File Summary table. If it doesn't match, stop and check.
6. **After completing Steps 2–15, run a quick smoke test** before proceeding:
   ```bash
   cd packages/bitcore-common
   node -e "require('./index.js')"   # should not throw
   ```
   If it throws, read the error, fix the broken require, and retry before continuing.

## Dependency Chain (execute in this order)

```
bn.js → utils.js → curve/base.js → curve/{short,mont}.js → curve/index.js
                                           ↕
ecdsa.js ← ec-signature.js ← ec-key.js
     ↕
schnorr.js, hash.js, random.js (new, no deps on elliptic)
```

---

## API Contract — Private Keys as Buffers

**Rule**: `bitcore-common`'s public-facing functions accept private keys as `Buffer` (raw 32-byte), NOT as strings.

This contract applies to:

| Function | Parameter | Expected Type | Notes |
|---|---|---|---|
| `ECDSA.sign(msgHash, privateKey)` | `privateKey` | `Buffer` (32 bytes) | Replaces elliptic's `keyPair` object |
| `Schnorr.sign(message, privateKey, aux?)` | `privateKey` | `Buffer` (32 bytes) | Already Buffer in bitcore-lib |
| `Schnorr.verify(message, signature, publicKey)` | `publicKey` | `Buffer` (32 bytes) | x-only pubkey |

**Internal handling**:
- Inside `bitcore-common`, private key `Buffer` → `BN` for arithmetic (this is internal, no string conversion)
- `new BN(privateKeyBuffer)` — bn.js accepts Buffer directly (no hex string needed)
- When a private key must be serialized (e.g., for Taproot tweaking), use `.toBuffer({ size: 32 })`

**Places in copied code where string-based BN is used — review needed**:

1. `ecdsa.js` (from elliptic): `new BN(msg, 16)` — **SAFE**: `msg` is a hash digest (32 bytes hex), not a key
2. `curve/short.js`: `new BN(x, 16)` for point coordinates — **SAFE**: public curve coordinates
3. `curve/short.js`: `new BN(conf.a, 16)` and `new BN(conf.b, 16)` — **SAFE**: curve constants
4. `curve/short.js`: `new BN(2)`, `new BN(3)`, `new BN(0)`, `new BN(1)` — **SAFE**: literal constants
5. `ecdsa.js`: `new BN(drbg.generate(bytes))` — **SAFE**: drbg output is a buffer, BN accepts Buffer
6. `schnorr.js` (new): `new BN(privateKey)` — **USE BUFFER**: pass `Buffer`, not hex string

**In `ecdsa.js` specifically** (Step 10), the elliptic source function signature is:
```js
// elliptic original:
EC.prototype.sign = function(msg, keyPair, opts)
// keyPair has: keyPair.d (BN), keyPair.getPublic() (Point)

// Our replacement:
ECDSA.sign = function(msgHash, privateKey)  // privateKey is Buffer
```

The adapter code in `ecdsa.js` must convert `privateKey (Buffer)` → `BN(privateKey)` internally. Do NOT do: `new BN(privateKey.toString('hex'))` — use `new BN(privateKey)` directly.

---

## STEP 1: Create directory structure

```
packages/bitcore-common/
├── package.json
├── index.js
├── NOTICE
├── lib/
│   ├── bn.js
│   ├── utils.js
│   ├── curve/
│   │   ├── base.js
│   │   ├── short.js
│   │   ├── mont.js
│   │   ├── index.js
│   │   └── secp256k1.js
│   ├── ecdsa.js
│   ├── ec-signature.js
│   ├── ec-key.js
│   ├── hmac-drbg.js
│   ├── schnorr.js
│   ├── hash.js
│   └── random.js
└── test/
```

Write `packages/bitcore-common/package.json`:
```json
{
  "name": "@bitcore-common/crypto",
  "version": "0.0.1",
  "description": "Crypto primitives for bitcore packages",
  "main": "index.js",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/bitcoin-bitcore/bitcore" },
  "scripts": { "test": "mocha test/**/*.js" },
  "dependencies": {},
  "devDependencies": { "mocha": "^10.2.0" }
}
```

Write `packages/bitcore-common/NOTICE`:
```
This package contains code derived from:
- elliptic (MIT) - https://github.com/indutny/elliptic
  Copyright (c) 2014-2018, Fedor Indutny.
- bn.js (MIT) - https://github.com/indutny/bn.js
  Copyright (c) 2014-2019, Fedor Indutny.
All derived code retains its original MIT license headers.
```

---

## STEP 2: Copy bn.js (no edits)

Source: `node_modules/bn.js/lib/bn.js`
Target: `lib/bn.js`

Copy file as-is. Keep existing MIT license header.

---

## STEP 3: Copy utils.js (inline 2 deps)

Source: `node_modules/elliptic/lib/elliptic/utils.js`
Target: `lib/utils.js`

Replace these 3 require lines at the top:
```js
var minAssert = require('minimalistic-assert');
var minUtils = require('minimalistic-crypto-utils');
var BN = require('bn.js');
```
With:
```js
var BN = require('./bn');
```

Replace these 5 assignment lines near the top:
```js
utils.assert = minAssert;
utils.toArray = minUtils.toArray;
utils.zero2 = minUtils.zero2;
utils.toHex = minUtils.toHex;
utils.encode = minUtils.encode;
```
With inline implementations:
```js
utils.assert = function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
};
utils.toArray = function toArray(str, encoding) {
  if (typeof str === 'string') {
    if (encoding === 'hex') return hexToArray(str);
    return Array.prototype.slice.call(str, 0);
  }
  return str;
};
function hexToArray(hex) {
  var arr = new Array(hex.length / 2);
  for (var i = 0; i < hex.length; i++) arr[i] = parseInt(hex[i*2]+hex[i*2+1], 16);
  return arr;
}
utils.zero2 = function zero2(str) {
  if (str.length % 2) str = '0' + str;
  return str;
};
utils.toHex = function toHex(buf) {
  var hex = '';
  for (var i = 0; i < buf.length; i++) hex += zero2(buf[i].toString(16));
  return hex;
};
utils.encode = function encode(arrays, encoding) {
  var out = [];
  for (var i = 0; i < arrays.length; i++) {
    var a = arrays[i];
    if (typeof a === 'string') {
      if (encoding === 'hex') {
        var arr = hexToArray(a);
        for (var j = 0; j < arr.length; j++) out.push(arr[j]);
      } else {
        for (var j = 0; j < a.length; j++) out.push(a.charCodeAt(j));
      }
    } else {
      for (var j = 0; j < a.length; j++) out.push(a[j]);
    }
  }
  return out;
};
function zero2(s) { if (s.length % 2) s = '0' + s; return s; }
```

---

## STEP 4: Copy curve/base.js (inline inherits + assert)

Source: `node_modules/elliptic/lib/elliptic/curve/base.js`
Target: `lib/curve/base.js`

Replace these 4 require lines at top:
```js
var utils = require('../utils');
var BN = require('bn.js');
var inherits = require('inherits');
var assert = require('minimalistic-assert');
```
With:
```js
var utils = require('../utils');
var BN = require('../bn');
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
```
(Use `utils.assert` instead of `assert` — already inlined in utils.js)

---

## STEP 5: Copy curve/short.js (inline inherits)

Source: `node_modules/elliptic/lib/elliptic/curve/short.js`
Target: `lib/curve/short.js`

Replace these 5 require lines at top:
```js
var utils = require('../utils');
var BN = require('bn.js');
var inherits = require('inherits');
var Base = require('./base');
var assert = utils.assert;
```
With:
```js
var utils = require('../utils');
var BN = require('../bn');
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
var Base = require('./base');
```

---

## STEP 6: Copy curve/mont.js (inline inherits)

Source: `node_modules/elliptic/lib/elliptic/curve/mont.js`
Target: `lib/curve/mont.js`

Replace these 4 require lines at top:
```js
var utils = require('../utils');
var BN = require('bn.js');
var inherits = require('inherits');
var Base = require('./base');
```
With:
```js
var utils = require('../utils');
var BN = require('../bn');
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
var Base = require('./base');
```

---

## STEP 7: Copy curve/index.js (inline inherits)

Source: `node_modules/elliptic/lib/elliptic/curve/index.js`
Target: `lib/curve/index.js`

Replace:
```js
var inherits = require('inherits');
var Base = require('./base');
```
With:
```js
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
var Base = require('./base');
```

---

## STEP 8: Copy ec/signature.js (no edits needed)

Source: `node_modules/elliptic/lib/elliptic/ec/signature.js`
Target: `lib/ec-signature.js`

This file only requires `bn.js` and `minimalistic-assert`. But elliptic's ec/signature.js actually only requires `bn.js` and `minimalistic-assert` — check for `require('minimalistic-assert')` and if present, replace with nothing (assertions are optional in signature encoding). Verify the file compiles with just `var BN = require('../bn');` as the require.

Actually, let me be precise — the agent should read the file and check for any requires that need fixing.

---

## STEP 9: Copy ec/key.js (resolve deps)

Source: `node_modules/elliptic/lib/elliptic/ec/key.js`
Target: `lib/ec-key.js`

Replace requires:
```js
var BN = require('bn.js');
var utils = require('../utils');
var assert = require('minimalistic-assert');
var EC = require('./index');
```
With:
```js
var BN = require('../bn');
var utils = require('../utils');
var EC = require('./ecdsa');
```

---

## STEP 10: Copy ec/index.js as ecdsa.js (resolve deps)

Source: `node_modules/elliptic/lib/elliptic/ec/index.js`
Target: `lib/ecdsa.js`

Replace requires at top:
```js
var BN = require('bn.js');
var utils = require('../utils');
var HmacDRBG = require('hmac-drbg');
var hash = require('hash.js');
var curves = require('../curves');
var assert = require('minimalistic-assert');
var rand = require('brorand');
```
With:
```js
var BN = require('../bn');
var utils = require('../utils');
var HmacDRBG = require('./hmac-drbg');
var crypto = require('crypto');
var hash = {
  sha256: function() { return crypto.createHash('sha256'); },
  sha256k: function() { return crypto.createHash('sha256'); },
  sha384: function() { return crypto.createHash('sha384'); },
  sha512: function() { return crypto.createHash('sha512'); },
  ripemd160: function() { return crypto.createHash('ripemd160'); },
  sha3: function() { return crypto.createHash('sha3-256'); }
};
var curves = require('../curve/secp256k1');
var rand = require('../random');
```

**CRITICAL — Function signature adaptation**:

The elliptic source exports methods on `EC.prototype`:
```js
EC.prototype.sign = function(msg, keyPair, opts)  // keyPair.d is BN
EC.prototype.verify = function(msg, signature)
```

We need to wrap these with our Buffer-based API. After the copied code, ADD these wrapper exports:
```js
var EC = module.exports = function EC(curveName) { this.curve = curves; };

// Keep the original prototype methods for internal use
// ... (copied code continues unchanged) ...

// NEW: Buffer-based public API
ECDSA.sign = function sign(msgHash, privateKey) {
  // privateKey is Buffer (32 bytes) — do NOT convert to string
  var keyPair = new EC().genKeyPair(privateKey);  // or create keyPair from Buffer
  var ec = new EC('secp256k1');
  return ec.sign(msgHash, keyPair);
};
```

Actually — the simplest approach: after copying the elliptic `ec/index.js` code as-is, create a thin adapter module at the bottom that wraps the EC methods with Buffer-based signatures. Do NOT modify the copied elliptic code's function signatures. The copied code stays IDENTICAL. The adapter goes in the same file after the copied code, OR in a separate adapter function.

**Recommendation**: Keep the copied `ec/index.js` code 100% identical. Then at the bottom of `lib/ecdsa.js`, add:
```js
// === Buffer-based public API (not from elliptic) ===
exports.sign = function sign(msgHash, privateKey) {
  // privateKey: Buffer(32)
  var ec = new EC('secp256k1');
  var keyPair = ec.keyFromPrivate(privateKey);
  return ec.sign(msgHash, keyPair);
};
exports.verify = function verify(msgHash, signature, publicKey) {
  // publicKey: Buffer(32) — x coordinate
  var ec = new EC('secp256k1');
  var pub = ec.keyFromPublic(publicKey);
  return ec.verify(msgHash, signature);
};
```

The `keyFromPrivate(buffer)` method exists on elliptic's EC class — it accepts a Buffer or BN. Check that `ec.keyFromPrivate` accepts Buffer in the copied code. If not, use `keyFromPrivate(privateKey.toString('hex'))` ONLY here — this is the single place where we convert Buffer → hex string, and it's in the adapter, not the core logic.
```

---

## STEP 11: Create curve/secp256k1.js

Target: `lib/curve/secp256k1.js`

Create this file:
```js
'use strict';
var ShortCurve = require('./short');
var curve = new ShortCurve({
  p: 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  n: 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  g: ['55066263022277343669578718895168534326250603453777594175500187360389116729240',
      '32670510020758816978083085130507043184471273380659243275938904335757245426176'],
  a: 0,
  b: 7,
  h: 1
});
module.exports = curve;
```

---

## STEP 12: Copy/Adapt schnorr.js

Source: `lib/crypto/schnorr.js` in bitcore-lib
Target: `lib/schnorr.js`

Copy the existing Schnorr implementation from bitcore-lib. Replace:
- `require('elliptic')` / `require('./point')` → `require('./curve/secp256k1')`
- `require('./bn')` → `require('./bn')`
- Hash functions → use Node.js `crypto` module
- `Point.getG()`, `Point.getN()`, `Point.getP()`, `Point.fromX()`, `.mul()`, `.getX()`, etc. → use curve exports directly

**API contract**: `Schnorr.sign(message, privateKey)` — `privateKey` is `Buffer` (32 bytes).
In the existing bitcore-lib code, `privateKey` may be a `PrivateKey` object or `Buffer`.
Convert to Buffer before use:
```js
privateKey = Buffer.isBuffer(privateKey) ? privateKey : privateKey.toBuffer();
// Then: const dPrime = new BN(privateKey);  // BN accepts Buffer directly
```
Do NOT convert to hex string before creating BN.

---

## STEP 13: Create hash.js

Target: `lib/hash.js`

Implement using Node.js native `crypto`:
```js
'use strict';
var crypto = require('crypto');

exports.sha256 = function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
};
exports.sha256d = function sha256d(buf) {
  return exports.sha256(exports.sha256(buf));
};
exports.ripemd160 = function ripemd160(buf) {
  return crypto.createHash('ripemd160').update(buf).digest();
};
exports.hmac_sha256 = function hmac_sha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
};
exports.taggedHash = function taggedHash(tag, data) {
  var tagHash = exports.sha256(Buffer.from(tag, 'utf8'));
  return exports.sha256(Buffer.concat([tagHash, tagHash, data]));
};
```

---

## STEP 14: Create random.js

Target: `lib/random.js`

```js
'use strict';
var crypto = require('crypto');

exports.randomBytes = function(n) {
  return crypto.randomBytes(n);
};
```

---

## STEP 15: Create index.js

Target: `packages/bitcore-common/index.js`

```js
'use strict';
var ECDSA = require('./lib/ecdsa');
var Schnorr = require('./lib/schnorr');

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
  
  /**
   * ECDSA.sign(msgHash, privateKey)
   * @param {Buffer} msgHash — 32-byte message hash
   * @param {Buffer} privateKey — 32-byte raw private key (NOT a hex string)
   * @returns {Signature} { r: BN, s: BN, i: number }
   */
  ECDSA: ECDSA,
  
  /**
   * Schnorr.sign(message, privateKey, aux)
   * @param {Buffer} message — arbitrary message buffer
   * @param {Buffer} privateKey — 32-byte raw private key (NOT a hex string)
   * @param {Buffer} [aux] — optional 32-byte aux (BIP-340)
   * @returns {Buffer} 64-byte signature [r || s]
   */
  Schnorr: Schnorr,
  
  Hash: require('./lib/hash'),
  Random: require('./lib/random'),
};
```

---

## STEP 16: Add to monorepo workspaces

In monorepo root `package.json`, add `"packages/bitcore-common"` to the workspaces array.

---

## STEP 17: Verify and test

1. Run `npm install` at monorepo root
2. Run `cd packages/bitcore-common && npm install && npm test`
3. Run bitcore-lib test suite — should pass with no changes yet (we haven't replaced elliptic in bitcore-lib)
4. Compare outputs against test vectors in `elliptic_rm_TMP/ecdsa_test_vectors.json` and `schnorr_test_vectors.json`

## File Summary

| # | File | Source | Lines | Edits Needed |
|---|------|--------|-------|-------------|
| 1 | `lib/bn.js` | `node_modules/bn.js/lib/bn.js` | 3427 | None |
| 2 | `lib/utils.js` | `node_modules/elliptic/lib/elliptic/utils.js` | 119 | Inline 2 deps, fix 3 requires |
| 3 | `lib/curve/base.js` | `node_modules/elliptic/lib/elliptic/curve/base.js` | 376 | Inline inherits, fix 4 requires |
| 4 | `lib/curve/short.js` | `node_modules/elliptic/lib/elliptic/curve/short.js` | 937 | Inline inherits, fix 5 requires |
| 5 | `lib/curve/mont.js` | `node_modules/elliptic/lib/elliptic/curve/mont.js` | 178 | Inline inherits, fix 4 requires |
| 6 | `lib/curve/index.js` | `node_modules/elliptic/lib/elliptic/curve/index.js` | 8 | Inline inherits, fix 2 requires |
| 7 | `lib/ecdsa.js` | `node_modules/elliptic/lib/elliptic/ec/index.js` | 241 | Fix 7 requires, add crypto shim |
| 8 | `lib/ec-signature.js` | `node_modules/elliptic/lib/elliptic/ec/signature.js` | 166 | Check for requires to fix |
| 9 | `lib/ec-key.js` | `node_modules/elliptic/lib/elliptic/ec/key.js` | 118 | Fix 4 requires |
| 10 | `lib/curve/secp256k1.js` | New | ~15 | Write from scratch |
| 11 | `lib/ec-signature.js` | Copy from elliptic | 166 | Check requires |
| 12 | `lib/schnorr.js` | `bitcore-lib/lib/crypto/schnorr.js` | ~150 | Adapt imports |
| 13 | `lib/hash.js` | New | ~30 | Write from scratch |
| 14 | `lib/random.js` | New | ~10 | Write from scratch |
| 15 | `index.js` | New | ~15 | Write from scratch |
| | **Total copied** | | **~5,420** | |
| | **Total new** | | **~200** | |
