# Script

All bitcoin transactions have scripts embedded into its inputs and outputs.
The scripts use a very simple programming language, which is evaluated from
left to right using a stack. The language is designed such that it guarantees
all scripts will execute in a limited amount of time (it is not Turing-Complete).

When a transaction is validated, the input scripts are concatenated with the output
scripts and evaluated. To be valid, all transaction scripts must evaluate to true. 
A good analogy for how this works is that the output scripts are puzzles that specify
in which conditions can those bitcoins be spent. The input scripts provide the correct
data to make those output scripts evaluate to true.


For more detailed information about the bitcoin scripting language, check the
online reference: https://en.bitcoin.it/wiki/Script

The `Script` object provides an interface to construct, parse, and identify bitcoin
scripts. It also gives simple interfaces to create most common script types. This class
is useful if you want to create custom input or output scripts. In other case,
you should probably use `Transaction`.


## Script creation

Here's how to use `Script` to create the five most common script types:

### Pay to Public Key Hash (p2pkh)

This is the most commonly used transaction output script. It's used to pay to
a bitcoin address (a bitcoin address is a public key hash encoded in base58check)

```javascript
// create a new p2pkh paying to a specific address
var address = Address.fromString('1NaTVwXDDUJaXDQajoa9MqHhz4uTxtgK14');
var s = Script.buildPublicKeyHashOut(address);
console.log(s.toString());
// 'OP_DUP OP_HASH160 20 0xecae7d092947b7ee4998e254aa48900d26d2ce1d OP_EQUALVERIFY OP_CHECKSIG'
```
### Pay to Public Key (p2pk)

Pay to public key scripts are a simplified form of the p2pkh,
but aren’t commonly used in new transactions anymore, because p2pkh scripts are
more secure (the public key is not revealed until the output is spent). 

```javascript
// create a new p2pk paying to a specific public key
var pubkey = new PublicKey('022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da');
var s = Script.buildPublicKeyOut(pubkey);
console.log(s.toString());
// '33 0x022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da OP_CHECKSIG'
```

### Pay to Multisig (p2ms)

Multisig outputs allow to share control of bitcoins between several keys. When creating
the script, one specifies the public keys that control the funds, and how many of those
keys are required to sign off spending transactions to be valid. An output with N public keys
of which M are required is called an m-of-n output (For example, 2-of-3, 3-of-5, 4-of-4, etc.)

Note that regular multisig outputs are rarely used nowadays. The best practice
is to use a p2sh multisig output (See Script#toScriptHashOut()).

```javascript
// create a new 2-of-3 multisig output from 3 given public keys
var pubkeys = [
  new PublicKey('022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da'),
  new PublicKey('03e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e9'),
  new PublicKey('021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc18'),
];
var m = 2;
var s = Script.buildMultisigOut(pubkeys, m);
console.log(s.toString());
// 'OP_2 33 0x022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da 33 0x03e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e9 33 0x021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc18 OP_3 OP_CHECKMULTISIG'
```

### Pay to Script Hash (p2sh)

Pay to script hash outputs are scripts that contain the hash of another script, called redeemScript.
To spend bitcoins sent in a p2sh output, the spending transaction must provide a script
matching the script hash and data which makes the script evaluate to true.
This allows to defer revealing the spending conditions to the moment of spending. It also
makes it possible for the receiver to set the conditions to spend those bitcoins. 

Most multisig transactions today use p2sh outputs where the redeemScript is a multisig output.

```javascript
// create a p2sh multisig output
var pubkeys = [
  new PublicKey('022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da'),
  new PublicKey('03e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e9'),
  new PublicKey('021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc18'),
];
var redeemScript = Script.buildMultisigOut(pubkeys, 2);
var s = redeemScript.toScriptHashOut();
console.log(s.toString());
// 'OP_HASH160 20 0x620a6eeaf538ec9eb89b6ae83f2ed8ef98566a03 OP_EQUAL'
```
### Data output

Data outputs are used to push data into the blockchain. Up to 40 bytes can be pushed
in a standard way, but more data can be used, if a miner decides to accept the transaction.

```javascript
var data = 'hello world!!!';
var s = Script.buildDataOut(data);
console.log(s.toString());
// 'OP_RETURN 14 0x68656c6c6f20776f726c64212121'
```

### Custom scripts

To create a custom `Script` instance, you must rely on the lower-level methods `add`
and `prepend`. Both methods accept the same parameter types, and insert an opcode or
data at the beginning (`prepend`) or end (`add`) of the `Script`.

```
var s = Script()
        .add('OP_IF')                       // add an opcode by name
        .prepend(114)                       // add OP_2SWAP by code
        .add(new Opcode('OP_NOT'))          // add an opcode object
        .add(new Buffer('bacacafe', 'hex')) // add a data buffer
console.log(s.toString());
// 'OP_2SWAP OP_IF OP_NOT 4 0xbacacafe'
```


## Script parsing and identification

`Script` has an easy interface to parse raw scripts from the newtwork or bitcoind, 
and to extract useful information.
An illustrative example (for more options check the API reference)
```
var raw_script = new Buffer('5221022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da2103e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e921021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc1853ae', 'hex');
var s = new Script(raw_script);
console.log(s.toString());
// 'OP_2 33 0x022df8750480ad5b26950b25c7ba79d3e37d75f640f8e5d9bcd5b150a0f85014da 33 0x03e3818b65bcc73a7d64064106a859cc1a5a728c4345ff0b641209fba0d90de6e9 33 0x021f2f6e1e50cb6a953935c3601284925decd3fd21bc445712576873fb8c6ebc18 OP_3 OP_CHECKMULTISIG'

s.isPublicKeyHashOut() // false
s.isScriptHashOut() // false
s.isMultisigOut() // true

```
