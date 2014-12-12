# Examples

## Create a private key

```
var privKey = new bitcore.PrivateKey();
```

## Create an Address
```
var privKey = new bitcore.PrivateKey();
var address = privKey.toAddress();
```

## Create a Multisig Address
```
???
```

## Request a Payment
```
var paymentInfo = {
  address: '1DNtTk4PUCGAdiNETAzQFWZiy2fCHtGnPx',
  amount: 120000 //satoshis
};
var uri = new bitcore.URI(paymentInfo).toString();
```

## Create a transaction
```
???
```

## Connect to the network
```
var peer = new Peer('5.9.85.34');

peer.on('inv', function(message) {
  // new invetory
});

peer.connect();
```
