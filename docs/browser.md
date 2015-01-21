---
title: Browser Builds
description: Guide to writing modules and optimizing browser bundles.
---

# Browser Builds

When developing a module that will depend on Bitcore, it's recommended to exclude Bitcore in the distributed browser bundle when using browserify and to use the `--external bitcore` parameter. It will produce a smaller browser bundle, as it will only include the JavaScript that is nessessary, and will depend on the Bitcore browser build which is better for distribution.

## Tutorial

**Step 1**: Require Bitcore

Here we require Bitcore and define the namespace (`index.js`):

```javascript

var bitcore = require('bitcore');
var PrivateKey = bitcore.PrivateKey;
var PublicKey = bitcore.PublicKey;
var Address = bitcore.Address;

```

See the [main file](https://github.com/bitpay/bitcore/blob/master/index.js) for bitcore for a complete list, as well as the [Bitcore Documentation](index.md).

**Step 2**: Browserifying

Next we will generate a browser bundle using [browserify](https://www.npmjs.com/package/browserify) by running the command:

```bash
browserify index.js:module-name --external bitcore -o module-name.js
```

This will output a file `module-name.js` with only the code loaded from `index.js` (bitcore.js will need to be loaded beforehand, which is around 145KB gzipped)

**Step 3**: Uglifying

This can be further optimized by using [uglifyjs](https://www.npmjs.com/package/uglify-js), and running the command:

```bash
uglifyjs module-name.js --compress --mangle -o module-name.min.js
```
