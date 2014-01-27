Bitcore
=======

A pure, powerful core for your bitcoin project.

Bitcore is a complete, native interface to the Bitcoin network, and provides the core functionality needed to develop apps for bitcoin.

#Principles
Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, but the developer community needs reliable, open-source tools to implement bitcoin apps and services.

**Bitcore unchains developers from fallible, centralized APIs, and provides the tools to interact with the real Bitcoin network.**

#Get Started

Bitcore runs on [node](http://nodejs.org/), and can be installed via [npm](https://npmjs.org/):
```
npm install bitcore
```

It's is a collection of objects useful to bitcoin applications; class-like idioms are enabled via [Classtool](https://github.com/gasteve/classtool). In most cases, a developer will require the object's class directly:
```
var Address = require('bitcore/Address').class();
```

#Examples

Validating a Bitcoin address:
```
var Address = require('bitcore/Address').class();

var addr = new Address("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");

try {
  addr.validate();
  console.log("Address is valid.");
} catch(e) {
  console.log(addr.data + " is not a valid address. " + e);
}
```

#Security
Please use at your own risk.

Bitcore is still under heavy development and not quite ready for "drop-in" production use. If you find a security issue, please email security@bitcore.io.

#Contributing
Bitcore needs some developer love. Please send pull requests for bug fixes, code optimization, and ideas for improvement.

