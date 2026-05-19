# Implementation Plan: Creating `bitcore-common` by Extracting from `elliptic`

This is a step-by-step, file-by-file implementation plan for an agentic coder. Every file, path, and required transformation is specified. No guessing required.

---

## Prerequisites

The following are already done (✅):
- Test vectors generated: `elliptic_rm_TMP/ecdsa_test_vectors.json`, `elliptic_rm_TMP/schnorr_test_vectors.json`
- Baseline benchmarks: `elliptic_rm_TMP/benchmark.js`, `elliptic_rm_TMP/benchmark_results.json`
- Current test suite runs and baseline documented

---

## File Inventory

### Source files to COPY (from elliptic/bn.js — all MIT licensed)

| # | Source Path | Target Path | Lines | External Deps to Resolve |
|---|---|---|---|---|
| 1 | `node_modules/elliptic/node_modules/bn.js/lib/bn.js` | `lib/bn.js` | 3427 | None (pure) |
| 2 | `node_modules/elliptic/lib/elliptic/curve/base.js` | `lib/curve/base.js` | 376 | `bn.js`, `inherits`, `utils.js`, `minimalistic-assert` |
| 3 | `node_modules/elliptic/lib/elliptic/curve/short.js` | `lib/curve/short.js` | 937 | `bn.js`, `inherits`, `utils.js`, `base.js`, `minimalistic-assert` |
| 4 | `node_modules/elliptic/lib/elliptic/curve/mont.js` | `lib/curve/mont.js` | 178 | `bn.js`, `inherits`, `utils.js`, `base.js`, `minimalistic-assert` |
| 5 | `node_modules/elliptic/lib/elliptic/curve/index.js` | `lib/curve/index.js` | 8 | `base.js`, `short.js`, `mont.js`, `edwards.js` |
| 6 | `node_modules/elliptic/lib/elliptic/ec/index.js` | `lib/ecdsa.js` | 241 | `bn.js`, `utils.js`, `hmac-drbg`, `brorand`, `minimalistic-assert`, `curve/` |
| 7 | `node_modules/elliptic/lib/elliptic/ec/signature.js` | `lib/ec-signature.js` | 166 | `bn.js`, `minimalistic-assert` |
| 8 | `node_modules/elliptic/lib/elliptic/ec/key.js` | `lib/ec-key.js` | 118 | `bn.js`, `utils.js`, `ec/index.js`, `minimalistic-assert` |
| 9 | `node_modules/elliptic/lib/elliptic/utils.js` | `lib/utils.js` | 119 | `bn.js`, `minimalistic-assert`, `minimalistic-crypto-utils` |

### Files to CREATE from scratch

| # | Target Path | Purpose |
|---|---|---|
| 10 | `lib/curve/secp256k1.js` | secp256k1 curve config (small) |
| 11 | `lib/schnorr.js` | BIP-340 Schnorr (adapted from bitcore-lib) |
| 12 | `lib/hash.js` | Hash utilities (Node.js native crypto) |
| 13 | `lib/random.js` | Secure random (Node.js native crypto) |
| 14 | `index.js` | Public API exports |

---

## Step-by-Step Implementation

### STEP 1: Create package structure

Create the following files:

```
packages/bitcore-common/
├── package.json
├── index.js
├── lib/
│   ├── bn.js
│   ├── utils.js
│   ├── curve/
│   │   ├── index.js
│   │   ├── base.js
│   │   ├── short.js
│   │   ├── mont.js
│   │   └── secp256k1.js
│   ├── ecdsa.js
│   ├── ec-signature.js
│   ├── ec-key.js
│   ├── schnorr.js
│   ├── hash.js
│   └── random.js
├── test/
│   └── ...
└── NOTICE
```

#### 1a. Write `packages/bitcore-common/package.json`

```json
{
  "name": "@bitcore-common/crypto",
  "version": "0.0.1",
  "description": "Crypto primitives for bitcore packages",
  "main": "index.js",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/bitcoin-bitcore/bitcore"
  },
  "scripts": {
    "test": "mocha test/**/*.js"
  },
  "dependencies": {},
  "devDependencies": {
    "mocha": "^10.2.0"
  }
}
```

#### 1b. Write `packages/bitcore-common/NOTICE`

```
This package contains code derived from:

- elliptic (MIT License) - https://github.com/indutny/elliptic
  Copyright (c) 2014-2018, Fedor Indutny.
  Used: lib/elliptic/curve/base.js, lib/elliptic/curve/short.js,
       lib/elliptic/curve/mont.js, lib/elliptic/curve/index.js,
       lib/elliptic/ec/index.js, lib/elliptic/ec/signature.js,
       lib/elliptic/ec/key.js, lib/elliptic/utils.js

- bn.js (MIT License) - https://github.com/indutny/bn.js
  Copyright (c) 2014-2019, Fedor Indutny.
  Used: lib/bn.js

All derived code retains its original MIT license headers.
```

---

### STEP 2: Copy `bn.js` (no modifications needed)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/bn.js/lib/bn.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/bn.js`

- Copy the file **as-is**. No modifications required.
- The original file already has the MIT license header at the top.

---

### STEP 3: Copy `utils.js` (resolve 2 external deps)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/lib/elliptic/utils.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/utils.js`

**External deps to resolve** (these 3 requires need fixing):

```js
// ORIGINAL (lines in source):
var minAssert = require('minimalistic-assert');
var minUtils = require('minimalistic-crypto-utils');
var BN = require('bn.js');

// REPLACE WITH:
var minAssert = require('./assert');    // we provide this
var minUtils = require('./minimalistic-crypto-utils'); // we provide this
var BN = require('./bn');               // our copied bn.js
```

Then append these two helper modules at the end of the file:

**3a. Inline `minimalistic-assert`** (it's just one function):

```js
// At the end of utils.js, after the existing exports:
utils.assert = function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg || 'Assertion failed');
  }
};
```

Then **remove or comment out** the line: `utils.assert = minAssert;`

**3b. Inline `minimalistic-crypto-utils` helpers** (the ones actually used by elliptic):

The functions from `minimalistic-crypto-utils` that elliptic's `utils.js` exports:
- `toArray(str, encoding)`
- `zero2(str)`
- `toHex(buf)`
- `encode(arrays, encoding)`

Inline them directly in `utils.js`:

```js
// Append after the existing code:

utils.toArray = function toArray(str, encoding) {
  if (typeof str === 'string') {
    if (encoding === 'hex')
      return utils.hexToArray(str);
    return Array.prototype.slice.call(str, 0);
  }
  return str;
};

utils.hexToArray = function hexToArray(hex) {
  var arr = new Array(hex.length / 2);
  for (var i = 0; i < hex.length; i++) {
    arr[i] = parseInt(hex[i * 2] + hex[i * 2 + 1], 16);
  }
  return arr;
};

utils.zero2 = function zero2(str) {
  if (str.length % 2)
    str = '0' + str;
  return str;
};

utils.toHex = function toHex(buf) {
  var hex = '';
  for (var i = 0; i < buf.length; i++) {
    hex += utils.zero2(buf[i].toString(16));
  }
  return hex;
};

utils.encode = function encode(arrays, encoding) {
  var out = [];
  for (var i = 0; i < arrays.length; i++) {
    var a = arrays[i];
    if (typeof a === 'string') {
      if (encoding === 'hex') {
        var arr = utils.hexToArray(a);
        for (var j = 0; j < arr.length; j++)
          out.push(arr[j]);
      } else {
        for (var j = 0; j < a.length; j++)
          out.push(a.charCodeAt(j));
      }
    } else {
      for (var j = 0; j < a.length; j++)
        out.push(a[j]);
    }
  }
  return out;
};
```

Then **remove or comment out** the lines:
```js
// utils.toArray = minUtils.toArray;
// utils.zero2 = minUtils.zero2;
// utils.toHex = minUtils.toHex;
// utils.encode = minUtils.encode;
```

---

### STEP 4: Copy `curve/base.js` (resolve deps)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/lib/elliptic/curve/base.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/curve/base.js`

**Changes needed** (at the top of the file):

```js
// ORIGINAL:
var utils = require('../utils');
var BN = require('bn.js');
var inherits = require('inherits');
var assert = require('minimalistic-assert');

// REPLACE WITH:
var utils = require('../utils');
var BN = require('../bn');
// inherits replacement (inline, no external dep needed):
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
// assert is now built into utils.js
```

That's it. All other `require` paths (`../utils`, `../bn`) remain correct.

---

### STEP 5: Copy `curve/short.js` (resolve deps)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/lib/elliptic/curve/short.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/curve/short.js`

**Changes needed**:

```js
// ORIGINAL:
var utils = require('../utils');
var BN = require('bn.js');
var inherits = require('inherits');
var Base = require('./base');
var assert = utils.assert;

// REPLACE WITH:
var utils = require('../utils');
var BN = require('../bn');
// inline inherits (same as above):
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
var Base = require('./base');
```

All other requires are already relative (`../utils`, `../bn`, `./base`) and will resolve correctly.

---

### STEP 6: Copy `curve/mont.js` (resolve deps)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/lib/elliptic/curve/mont.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/curve/mont.js`

Same pattern — replace the 4 requires at the top:

```js
// ORIGINAL:
var utils = require('../utils');
var BN = require('bn.js');
var inherits = require('inherits');
var Base = require('./base');

// REPLACE WITH:
var utils = require('../utils');
var BN = require('../bn');
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
var Base = require('./base');
```

---

### STEP 7: Copy `curve/index.js` (resolve deps)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/lib/elliptic/curve/index.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/curve/index.js`

```js
// ORIGINAL:
varinherits = require('inherits');
var Base = require('./base');

// REPLACE WITH:
var inherits = function(cls, superCls) {
  cls.prototype = Object.create(superCls.prototype);
  cls.prototype.constructor = cls;
};
var Base = require('./base');
```

Note: `index.js` also requires `short.js`, `mont.js`, and `edwards.js`. The `edwards.js` file is NOT in our copy list — it won't be imported unless someone calls it. The current `index.js` exports `EC` from `../ec/index.js` and the curve classes. We'll keep `index.js` simple and only export what we need.

---

### STEP 8: Copy `ec/index.js` as `lib/ecdsa.js` (resolve deps)

**Source**: `/Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/lib/elliptic/ec/index.js`
**Target**: `/Users/bpmj/dev/bitcore/packages/bitcore-common/lib/ecdsa.js`

This is the biggest one. **Changes needed**:

```js
// ORIGINAL requires at top:
var BN = require('bn.js');
var utils = require('../utils');
var HmacDRBG = require('hmac-drbg');
var hash = require('hash.js');
var curves = require('../curves');
var assert = require('minimalistic-assert');
var rand = require('brorand');

// REPLACE WITH:
var BN = require('../bn');
var utils = require('../utils');
// HmacDRBG: we implement our own (needed for RFC 6979 deterministic k)
var HmacDRBG = require('./hmac-drbg');
// hash: use Node.js native crypto instead
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
// assert is inlined in utils.js
```

**Additional files to create** for this step:

**8a. `lib/hmac-drbg.js`** — reimplement elliptic's HmacDRBG using Node.js crypto. This is needed for RFC 6979 deterministic k in ECDSA signing. The original is at `node_modules/elliptic/node_modules/hmac-drbg/lib/hmac-drbg.js` (~180 lines). Copy it as-is, then fix its requires:

```js
// In hmac-drbg.js:
// ORIGINAL:
var Hash = require('hash.js');
var hmac = require('hmacjs');  // or similar

// REPLACE:
var crypto = require('crypto');
// Then replace Hash.sha256() with crypto.createHash('sha256')
// Replace Hash.ripemd160() with crypto.createHash('ripemd160')
// Replace HMAC with crypto.createHmac()
```

Actually, let me check the HmacDRGB source to be precise:

<tool_call>
<function=bash>
<parameter=command>
ls /Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/node_modules/hmac-drbg/ 2>/dev/null && wc -l /Users/bpmj/dev/bitcore/packages/bitcore-lib/node_modules/elliptic/node_modules/hmac-drbg/lib/hmac-drbg.js 2>/dev/null