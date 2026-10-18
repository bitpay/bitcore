# Bitcore Hardware
**A coin-agnostic hardware wallet library for getting data and signing transactions with ledger and burner.**

## Usage
Get a bitcoin address with a ledger device
```JavaScript
import { HwProxy } from '@bitpay-labs/bitcore-hardware';

await HwProxy.connect();

const ledgerAddress = await HwProxy.getAddress({ vendor: 'ledger', connection: 'speculos', chain: 'BTC' });
console.log(ledgerAddress);
// bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq
```
Sign a bitcoin transaction with a ledger device
```JavaScript
// utxos from https://api.bitcore.io/api/BTC/mainnet/address/bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq/coins
const utxos = [
  {
    chain: 'BTC',
    network: 'mainnet',
    coinbase: false,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4',
    mintHeight: 957071,
    spentHeight: -2,
    address: 'bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq',
    script: '001491f570a0236f1b6b40f52514c6e6623eacd56a0b',
    value: 1562,
    confirmations: -1
  }
];

const tx: string = CWC.Transactions.create({
  chain: 'BTC',
  recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: 1200 }],
  utxos
});

const signedTransaction = await HwProxy.sign({
  vendor: 'ledger',
  connection: 'speculos',
  chain: 'BTC',
  tx,
  utxos
});

console.log(signedTransaction);
/* 
Broadcasted using bitcore-node
$ curl --header "Content-Type: application/json" --request POST -d '{"rawTx": "02000000000101b405040dc80bbd0d0c0e5d36e89c90c3879dd0044aa62e0cdcdf2713199a51780000000000ffffffff01b004000000000000160014dd3b3ea310eb69632adc047ec7ca82e9ac61f9790247304402205e0bc606e3e76e8c623b4de8fd1c1ac098aaf32b161310f7dbaa14d8d29dcd2602203fd47d3d1fb0b223b203a5d01fd28804296666d1a15d1040d4140ba4bfee6125012103a7c7057355969fb52b23744aae7275f10440620654a912a78684a8a697d92e2b00000000"}' https://api.bitcore.io/api/BTC/mainnet/tx/send
{"txid":"3049a6c75390696260366672693ebccf1a5a9892e3aa728b1f51c59e8f137a26"}

View on Insight: https://bitpay.com/insight/BTC/mainnet/tx/3049a6c75390696260366672693ebccf1a5a9892e3aa728b1f51c59e8f137a26
*/
```
Get an address with a burner device:
```JavaScript
await HwProxy.connect();

const burnerAddress = await HwProxy.getAddress({ vendor: 'burner', connection: 'nfc', chain: 'BTC' });
console.log(burnerAddress);
// bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk
```
Sign a transaction with a burner device:
```JavaScript
// utxo from https://api.bitcore.io/api/BTC/mainnet/address/bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk/coins
const utxos = [
  {
    chain: 'BTC',
    network: 'mainnet',
    coinbase: false,
    mintIndex: 0,
    spentTxid: '',
    mintTxid: '3f91933d95a2025e10f6a3c4d332c693921550036b1c2e9c2625189b4f49d6e4',
    mintHeight: 956531,
    spentHeight: -2,
    address: 'bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk',
    script: '001456c5557b413096aa9ce65ef7f2e6133df73bca8b',
    value: 8050,
    confirmations: -1
  }
];

const tx: string = CWC.Transactions.create({
  chain: 'BTC',
  recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: 7800 }],
  utxos
});

const signedTransaction: any = await HwProxy.sign({
  vendor: 'burner',
  connection: 'nfc',
  chain: 'BTC',
  tx,
  utxos,
  password: '123456'
});
console.log(signedTransaction);
/*
Broadcasted using bitcore-node:
$ curl --header "Content-Type: application/json" --request POST -d '{"rawTx":"02000000000101e4d6494f9b1825269c2e1c6b0350159293c632d3c4a3f6105e02a2953d93913f0000000000ffffffff01781e000000000000160014dd3b3ea310eb69632adc047ec7ca82e9ac61f97902483045022100ea2a45801e44f57dfc55f40f38d13122fb14d654ac54ac45ff8619420a15803a0220724ffad2f689561961a1d3e5d6b87998f461d8f891a66f5043bfe7b99ce6c2db012102161f62f9778a44bd3d07009b1f2e9df7ab1dc57e74665db7ed8baa95780452ab00000000"}' https://api.bitcore.io/api/BTC/mainnet/tx/send
{"txid":"13468b95f83bd346ddd96fafa145d078da9265529829c7fa43324cfba557b243"}

View on Insight: https://bitpay.com/insight/BTC/mainnet/tx/13468b95f83bd346ddd96fafa145d078da9265529829c7fa43324cfba557b243
*/
```

See examples for more

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2026 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
