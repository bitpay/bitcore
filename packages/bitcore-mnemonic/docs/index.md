# Mnemonic

The `Mnemonic` class provides an implementation of a mnemonic code or mnemonic sentence – a group of easy to remember words – for the generation of deterministic keys. The class handles code generation and its later conversion to a [HDPrivateKey](hierarchical.md). See [the official BIP-0039](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) for technical background information.

## Installation

Mnemonics is implemented as a separate module and you must add it to your dependencies:

For node projects:

```sh
npm install bitcore-mnemonic --save
```

For client-side projects:

```sh
bower install bitcore-mnemonic --save
```

## Mnemonic generation

For creating a new random mnemonic code you just create a new instance.

```javascript
var Mnemonic = require('bitcore-mnemonic');
var code = new Mnemonic();

code.toString(); // 'select scout crash enforce riot rival spring whale hollow radar rule sentence'
```

## Multi-language support

The `Mnemonic` class can use any list of 2048 unique words to generate the mnemonic code. For convenience the class provides default word lists for the following languages: English (default), Chinese, French, Japanese and Spanish. Those word list are published under `Mnemonic.Words.LANGUAGE`, take a look at the following example:

```javascript
var Mnemonic = require('bitcore-mnemonic');
var code = new Mnemonic(Mnemonic.Words.SPANISH);
code.toString(); // natal hada sutil año sólido papel jamón combate aula flota ver esfera...

var myWordList = [ 'abandon', 'ability', 'able', 'about', 'above', ... ];
var customCode = new Mnemonic(myWordList);
```

## Validating a mnemonic

The Mnemonic class provides a static method to check if a mnemonic string is valid. If you generated the mnemonic code using any of the default word list, the class will identify it, otherwise you must provide the word list used.

```javascript
var Mnemonic = require('bitcore-mnemonic');

var code = 'select scout crash enforce riot rival spring whale hollow radar rule sentence';
var valid = Mnemonic.isValid(code);

// using a custom word list
var validCutom = Mnemonic.isValid(code, customWordlist);
```

## Generating a private key

A mnemonic encodes entropy that can be used for creating a seed and later a [HDPrivateKey](hierarchical.md). During the seed generation process a passphrase can be used. The code for doing so looks like this:

```javascript
var Mnemonic = require('bitcore-mnemonic');
var code = new Mnemonic('select scout crash enforce riot rival spring whale hollow radar rule sentence');

var xpriv1 = code.toHDPrivateKey(); // no passphrase
var xpriv2 = code.toHDPrivateKey('my passphrase'); // using a passphrase
```
