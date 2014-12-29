title: Browser Builds
description: Guide to writing modules and optimizing browser bundles.
---

# Browser Builds

When developing a module that will need to work in a browser and does not use the entire Bitcore namespace, it's recommended to narrow the scope of the requires to the particular modules that are needed. It will produce a smaller browser bundle as it will only include the JavaScript that is nessessary. Below is a quick tutorial that will use three modules.

## Tutorial

**Step 1**: Require Bitcore Modules

Here we require specific Bitcore modules that will be used in a `index.js` file:

```javascript

var PrivateKey = require('bitcore/lib/privatekey');
var PublicKey = require('bitcore/lib/publickey');
var Address = require('bitcore/lib/address');

// the rest of the module here

```

**Step 2**: Browserifying

Next we will generate a browser bundle using [browserify](https://www.npmjs.com/package/browserify) by running the command:

```bash
browserify index.js -o index.browser.js
```

This will output a file `index.browser.js` at around 700KB *(the entire Bitcore namespace is around 2MB)*.

**Step 3**: Uglifying

This can be further optimized by using [uglifyjs](https://www.npmjs.com/package/uglify-js), and running the command:

```bash
uglifyjs index.browser.js --compress --mangle -o index.browser.min.js
```

The resulting file `index.browser.min.js` in this case should be less than 300KB.

## Modules

Here is a list of some of the common modules:

```javascript
var Address = require('bitcore/lib/address');
var Block = require('bitcore/lib/block');
var BlockHeader = require('bitcore/lib/blockheader');
var HDPrivateKey = require('bitcore/lib/hdprivatekey');
var HDPublicKey = require('bitcore/lib/hdpublickey');
var PaymentProtocol = require('bitcore/lib/paymentprotocol');
var PrivateKey = require('bitcore/lib/privatekey');
var PublicKey = require('bitcore/lib/publickey');
var Script = require('bitcore/lib/script');
var Transaction = require('bitcore/lib/transaction');
var URI = require('bitcore/lib/uri');
var Unit = require('bitcore/lib/unit');
```

For more informatation about each of the modules please see the [Bitcore Documentation](index.md).