# Modules
Modules are loaded before services are started. This allows code to hook into services and register classes, event handlers, etc that alter the behaviors of services.

## Known Modules
The modules in this table will automatically register with `bitcore-node` if your `bitcore.config.json` contains a valid configuration for their respective chains.

| Chain          | Module         | Module Path (Relative to ModuleManager) |
| -------------- | -------------- | -------------- |
| BTC            | bitcoin        | ./bitcoin      |
| ETH            | ethereum       | ./ethereum     |
| BCH            | bitcoin-cash   | ./bitcoin-cash |
| LTC            | litecoin       | ./litecoin     |
| DOGE           | dogecoin       | ./dogecoin     |
| XRP            | ripple         | ./ripple       |

If there is a custom or third-party module you'd like to use, follow the example below.

## Example - Syncing BCH
Let's say we have a node_module, named `bitcore-node-bch` with the following code

```
// index.js

module.exports = class BitcoinCashModule {
  constructor(services) {
    services.Libs.register('BCH', 'bitcore-lib-cash', 'bitcore-p2p-cash');
    services.P2P.register('BCH', services.P2P.get('BTC'));
  }
}
```

The module has the following dependencies
```
// package.json

  "dependencies": {
    "bitcore-lib-cash": "^8.3.4",
    "bitcore-p2p-cash": "^8.3.4"
  }

```

We could add this module by adding `bitcore-node-bch` to the modules array in bitcore.config.json

```
    modules: ['./bitcoin', 'bitcore-node-bch'],
```
