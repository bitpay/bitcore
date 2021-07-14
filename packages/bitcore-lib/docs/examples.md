# Bitcore examples

## Generate a random address

```javascript
var privateKey = new bitcore.PrivateKey();

var address = privateKey.toAddress();
```

## Generate a address from a SHA256 hash

```javascript
var value = Buffer.from('correct horse battery staple');
var hash = bitcore.crypto.Hash.sha256(value);
var bn = bitcore.crypto.BN.fromBuffer(hash);

var address = new bitcore.PrivateKey(bn).toAddress();
```

## Import an address via WIF

```javascript
var wif = 'Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct';

var address = new bitcore.PrivateKey(wif).toAddress();
```

## Create a Transaction

```javascript
var privateKey = new bitcore.PrivateKey('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy');
var utxo = {
  "txId" : "115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986",
  "outputIndex" : 0,
  "address" : "17XBj6iFEsf8kzDMGQk5ghZipxX49VXuaV",
  "script" : "76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac",
  "satoshis" : 50000
};

var transaction = new bitcore.Transaction()
  .from(utxo)
  .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 15000)
  .sign(privateKey);
```

## Sign a Bitcoin message

```javascript
var Message = require('bitcore-message');

var privateKey = new bitcore.PrivateKey('L23PpjkBQqpAF4vbMHNfTZAb3KFPBSawQ7KinFTzz7dxq6TZX8UA');
var message = new Message('This is an example of a signed message.');

var signature = message.sign(privateKey);
```

## Verify a Bitcoin message

```javascript
var Message = require('bitcore-message');

var address = '13Js7D3q4KvfSqgKN8LpNq57gcahrVc5JZ';
var signature = 'IBOvIfsAs/da1e36W8kw1cQOPqPVXCW5zJgNQ5kI8m57FycZXdeFmeyoIqJSREzE4W7vfDmdmPk0HokuJPvgPPE=';

var verified = new Message('This is an example of a signed message.').verify(address, signature);
 ```

## Create an OP RETURN transaction

```javascript
var privateKey = new bitcore.PrivateKey('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy');
var utxo = {
  "txId" : "115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986",
  "outputIndex" : 0,
  "address" : "17XBj6iFEsf8kzDMGQk5ghZipxX49VXuaV",
  "script" : "76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac",
  "satoshis" : 50000
};

var transaction = new bitcore.Transaction()
    .from(utxo)
    .addData('bitcore rocks') // Add OP_RETURN data
    .sign(privateKey);
```

## Create a 2-of-3 multisig P2SH address

```javascript
var publicKeys = [
  '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
  '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
  '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
];
var requiredSignatures = 2;

var address = new bitcore.Address(publicKeys, requiredSignatures);
```

## Spend from a 2-of-2 multisig P2SH address

```javascript
var privateKeys = [
  new bitcore.PrivateKey('91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx'),
  new bitcore.PrivateKey('91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT')
];
var publicKeys = privateKeys.map(bitcore.PublicKey);
var address = new bitcore.Address(publicKeys, 2); // 2 of 2

var utxo = {
  "txId" : "153068cdd81b73ec9d8dcce27f2c77ddda12dee3db424bff5cafdbe9f01c1756",
  "outputIndex" : 0,
  "address" : address.toString(),
  "script" : new bitcore.Script(address).toHex(),
  "satoshis" : 20000
};

var transaction = new bitcore.Transaction()
    .from(utxo, publicKeys, 2)
    .to('mtoKs9V381UAhUia3d7Vb9GNak8Qvmcsme', 20000)
    .sign(privateKeys);
```
