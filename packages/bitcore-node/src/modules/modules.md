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
| MATIC          | matic          | ./matic        |
| SOLANA         | solana         | ./solana       |
| Multiple (EVM) | moralis        | ./moralis      |

If there is a custom or third-party module you'd like to use, follow the example below.

## Example - Syncing BCH
Let's say we have a node_module, named `bitcore-node-bch` with the following code

```
// index.js

module.exports = class BitcoinCashModule {
  constructor(services, chain, network, config) {
    // chain === 'BCH'
    services.Libs.register(chain, '@bitpay-labs/bitcore-lib-cash', '@bitpay-labs/bitcore-p2p-cash');
    services.P2P.register(chain, network, services.P2P.get('BTC'));
  }
}
```

The module has the following dependencies
```
// package.json

  "dependencies": {
    "@bitpay-labs/bitcore-lib-cash": "^11.5.1",
    "@bitpay-labs/bitcore-p2p-cash": "^11.5.1"
  }

```

We could add this module by adding `bitcore-node-bch` to the chain-network's module in bitcore.config.json

```
  chains: {
    // ... other chain configs
    BCH: {
      mainnet: {
        // ... other config entries
        module: 'bitcore-node-bch'
      }
    }
  }
```

# Multi-chain providers

Some [included modules](#known-modules) support multiple chains. You can specify which module you want to use by specifying the module path in the chain config.

For example, `moralis` is a module for [Moralis.io](https://moralis.io), a blockchain provider service, that can be used for various chains.

> NOTE: For [known modules](#known-modules), make sure you give the _path_ of the module so it's not confused for a node_module.

```
  chains: {
    // ... other chain configs
    ARB: {
      mainnet: {
        // ... other config entries
        module: './moralis'
      }
    }
  }
```