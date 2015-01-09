title: Mnemonic
description: A simple interface to generate mnemonic codes and deterministic keys.
---
# Mnemonic

## Description

This modules provides a implementation of a mnemonic code or mnemonic sentence -- a group of easy to remember words -- for the generation of deterministic keys. This class handles mnemonic's generation and it's later conversion into a [HDPrivateKey](hierarchical.md). See [the official BIP-0039](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) for technical background information.

## Mnemonic generation

For creating a new random mnemonic code you just create a new instance.

```javascript
var Mnemonic = require('bitcore-mnemonic');
var code = new Mnemonic();

code.toString(); // 'select scout crash enforce riot rival spring whale hollow radar rule sentence'
```

## Multi-language support

The `Mnemonic` class can use any list of 2048 unique words to generate the mnemonic code. For convenience the class provides default word lists for the following languages: English (default), Chinese, Japanese and Spanish. Those word list are published under `Mnemonic.Words.LANGUAGE`, take a look at the following example:

```javascript
var Mnemonic = require('bitcore-mnemonic');
var code = new Mnemonic(Mnemonic.Words.SPANISH);
code.toString(); // natal hada sutil año sólido papel jamón combate aula flota ver esfera...

var myWordList = [ 'abandon', 'ability', 'able', 'about', 'above', ... ];
var customCode = new Mnemonic(myWordList);
```

## Validating a mnemonic

The Mnemonic class provides a function check if a mnemonic code is valid. If you generated the mnemonic code using any of the default word list, the class will identify it, otherwise you must provide the word list used.

```javascript
var Mnemonic = require('bitcore-mnemonic');

var code = 'select scout crash enforce riot rival spring whale hollow radar rule sentence';
var valid = Mnemonic.isValid(code);

// using a custom word list
var validCutom = Mnemonic.isValid(customCode, wordlist);
```

## Generating a private key

A mnemonic encodes entropy that can be used for creating a seed and later a [HDPrivateKey](hierarchical.md). During the process of generating a seed a passphrase can be used. The code for doing so looks like this:

```javascript
var Mnemonic = require('bitcore-mnemonic');
var code = new Mnemonic('select scout crash enforce riot rival spring whale hollow radar rule sentence');

var xpriv = code.toHDPrivateKey(); // no passphrase
var xpriv = code.toHDPrivateKey('my passphrase'); // using a passphrase
```
