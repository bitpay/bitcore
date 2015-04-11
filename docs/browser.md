---
title: Browser Builds
description: Guide to using and writing modules and optimizing browser bundles.
---

# Browser Builds

Bitcore and most official submodules work in the browser, thanks to [browserify](http://browserify.org/) (some modules are not fully compatible with web browsers).

The easiest and recommended way to use them, is via [Bower](http://bower.io/), a browser package manager, and get the release bundles.
For example, when building an app that uses `bitcore` and `bitcore-ecies`, you do:

```sh
bower install bitcore
bower install bitcore-ecies
```

You can also use a `bower.json` file to store the dependencies of your project:

```json
{
  "name": "Your app name",
  "version": "0.0.1",
  "license": "MIT",
  "dependencies": {
    "bitcore-ecies": "^0.10.0",
    "bitcore": "^0.10.4"
  }
}
```
and run `bower install` to install the dependencies.

After this, you can include the bundled release versions in your HTML file:
```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <script src="bower_components/bitcore/bitcore.min.js"></script>
  <script src="bower_components/bitcore-ecies/bitcore-ecies.min.js"></script>
</head>

<body>

  <script type="text/javascript">
    var bitcore = require('bitcore');
    var ECIES = require('bitcore-ecies');
    // etc...
  </script>

</body>

</html>
```

## Building Custom Bundles

If you want to use a specific version of a module, instead of a release version (not recommended), you must run browserify yourself. 
You can get a minified browser bundle by running the following on the project root folder.
```sh
browserify --require ./index.js:bitcore | uglifyjs > bitcore.min.js
```
(for bitcore)

```sh
browserify --require ./index.js:bitcore-ecies --external bitcore | uglifyjs > bitcore-ecies.min.js
```
(for a bitcore module, `bitcore-ecies` in the example)


## Development of Modules

*Note:* You probably don't want to use this method, but `bitcore-build`, as explained above. This is left here as documentation on what happens under the hood with `bitcore-build`.

When developing a module that will depend on Bitcore, it's recommended to exclude Bitcore in the distributed browser bundle when using browserify and to use the `--external bitcore` parameter. It will produce a smaller browser bundle, as it will only include the JavaScript that is nessessary, and will depend on the Bitcore browser build which is better for distribution.

### Building the Bundle Manually

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
