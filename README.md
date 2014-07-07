Bitcore
=======

[![Build Status](https://travis-ci.org/bitpay/bitcore.svg?branch=master)](https://travis-ci.org/bitpay/bitcore)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore.svg)](https://coveralls.io/r/bitpay/bitcore)

A pure, powerful core for your bitcoin project.

Bitcore is a complete, native interface to the Bitcoin network, and provides the core functionality needed to develop apps for bitcoin.

#Principles

Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, and the developer community needs reliable, open-source tools to implement bitcoin apps and services.

**Bitcore unchains developers from fallible, centralized APIs, and provides the tools to interact with the real Bitcoin network.**

#Get Started

Bitcore runs on [node](http://nodejs.org/), and can be installed via [npm](https://npmjs.org/):

```
npm install bitcore
```

It is a collection of objects useful to bitcoin applications; class-like idioms are enabled via [Soop](https://github.com/bitpay/soop). In most cases, a developer will require the object's class directly. For instance:

```
var bitcore = require('bitcore');
var Address = bitcore.Address;
var Transaction = bitcore.Transaction;
var PeerManager = bitcore.PeerManager;
```

#Examples

Examples are provided [here](examples.md)
Build the examples by installing and running gulp:

```
npm install -g gulp
gulp
```

Javascript files available at [/examples](/examples) folder.


#Security

Please use at your own risk.

Bitcore is still under heavy development and not quite ready for "drop-in" production use. If you find a security issue, please email security@bitcore.io.

#Contributing

Bitcore needs some developer love. Please send pull requests for bug fixes, code optimization, and ideas for improvement.

#Browser support

## Building the browser bundle

To build bitcore full bundle for the browser (this is automatically executed after you run `npm install`):

```
node browser/build.js -a
```

This will generate a `browser/bundle.js` file which you can include in your HTML to use bitcore in the browser.

##Example browser usage

From example/simple.html
```
<!DOCTYPE html>
<html>
  <body>
    <script src="../browser/bundle.js"></script>
    <script>
      var bitcore = require('bitcore');
      var Address = bitcore.Address;
      var a = new Address('1KerhGhLn3SYBEQwby7VyVMWf16fXQUj5d');
      console.log('1KerhGhLn3SYBEQwby7VyVMWf16fXQUj5d is valid? '+a.isValid());
    </script>
  </body>
</html>
```

You can check a more complex usage example at examples/example.html.

## Generating a customized browser bundle

To build the main bitcore bundle, run:

```
node browser/build.js -m
```

To build all features into the bitcore bundle (which will lead to a large filesize), run:

```
node browser/build.js -a
```

To generate a customized bitcore bundle, you can specify which submodules you want to include in it with the -s option:

```
node browser/build.js -s Transaction,Address
```

This will generate a `browser/bundle.js` containing only the Transaction and Address class, with all their dependencies.  Use this option if you are not using the whole bitcore library, to optimize the bundle size, script loading time, and general resource usage.

## Tests

Run tests in node:

```
mocha
```

Or generate tests in the browser:

```
grunt shell
```

And then open test/index.html in your browser.

To run the code coverage report:

```
npm run-script coverage
```

And then open coverage/lcov-report/index.html in your browser.

#License

**Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).**

Copyright 2013-2014 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/bitpay/bitcore/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
