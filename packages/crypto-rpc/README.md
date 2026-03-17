# Description
Crypto-RPC is a library that wraps other RPC libraries to create a normalized interface with RPCs.

# Usage

### Install
```sh
npm install @bitpay-labs/crypto-rpc
```

### Instantiation 

```javascript
import { CryptoRpc } from '@bitpay-labs/crypto-rpc';

const rpc = new CryptoRpc({
  chain: 'BTC',
  protocol: 'http',
  host: 'localhost',
  port: 8332,
  user: 'my-user',
  pass: 'my-password'
});
```

### Multiple Ways of Calling

```javascript
// Pass in the chain to the method to then call the chain's RPC instance
const tx = rpc.getTransaction({
  chain: 'BTC',
  txid: 'txid1'
});
```

OR

```javascript
// Gets the chain's specific RPC instance
const btc = rpc.get('BTC');
// Call the method on the instance
const tx = btc.getTransaction('txid1');
```