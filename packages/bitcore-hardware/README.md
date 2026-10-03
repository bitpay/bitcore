# Bitcore Hardware
**A coin-agnostic hardware wallet library for getting data and signing transactions with ledger and burner.**

## Usage
Get a bitcoin address from a ledger:
```JavaScript
const ledger = new Ledger();
await ledger.connect();

const address = await ledger.getAddress({ chain: 'BTC' });
console.log(address);
// bc1qqtl9jlrwcr3fsfcjj2du7pu6fcgaxl5dsw2vyg
```
Get a bitcoin address from a burner:
```JavaScript
const burner = new Burner();
burner.connect();

const address = await burner.getAddress({ chain: 'BTC', index: 9 });
console.log(address);
// bc1q2mz4276pxzt2488xtmml9esn8hmnhj5t3rd8gk
```

See examples for more

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2026 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
