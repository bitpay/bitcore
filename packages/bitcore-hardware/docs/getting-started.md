## Getting Started
Use the HwProxy (hardware proxy) to connect to a variety of hardware wallet devices on a variety of chains.
HwProxy can get an address, public key, and sign transactions.

Every time you use HwProxy, first connect all of the devices.
```JavaScript
import { HwProxy } from '@bitpay-labs/bitcore-hardware';

await HwProxy.connect();
```

HwProxy needs to know what device and which chain to connect to.
To choose a device, specify its vendor and connection type.

Getting an address and public key requires the same arguments across chains and devices.
All chains on all devices return a string for getting an address, public key and signing.

### HwProxy.getAddress
```JavaScript
const address = await HwProxy.getAddress({
  vendor: 'ledger',
  connection: 'speculos',
  chain: 'BTC'
});
// bc1qqtl9jlrwcr3fsfcjj2du7pu6fcgaxl5dsw2vyg
```
### HwProxy.getPublicKey
```JavaScript
const publicKey = await HwProxy.getPublicKey({
  vendor: 'ledger',
  connection: 'speculos',
  chain: 'BTC'
});
// 031869567d5e88d988ff7baf6827983f89530ddd79dbaeadaa6ec538a8f03dea8b
```

### HwProxy.sign
Signing varies a lot between devices and chains. However, a few of the arguents are always the same. Hardware proxy always takes in a transaction and always accepts it in string format.

```JavaScript
const signedTransaction = await HwProxy.sign({
  vendor: 'ledger',
  connection: 'speculos',
  chain: 'BTC',
  tx: '0200000001b405040dc80bbd0d0c0e5d36e89c90c3879dd0044aa62e0cdcdf2713199a51780000000000ffffffff01b0040000000000001976a9149227acb5d0f7a39f80ca839df17bbbeba36a3a1388ac00000000',
  ... // often other arguments are needed, such as utxos in this case
})
```
