# Installation

The following document is a step-by-step guide to run BWS.

## Prerequisites

Ensure MongoDB (3.4+) is installed and running. This document assumes that mongod is running at the default port 27017.
See the configuration section to configure a different host/port.

## Install BWS from NPM

Use the following steps to Install BWS from the npmjs repository and run it with defaults.

```sh
npm install @bitpay-labs/bitcore-wallet-service
cd bitcore-wallet-service
```

To change configuration before running, see the Configuration section.

```sh
npm start
```

## Install BWS from github source

Use the following steps to Install BWS from github source and run it with defaults.

```sh
git clone https://github.com/bitpay/bitcore.git
cd bitcore
npm install
```

To change configuration before running, see the Configuration section.

```sh
npm run bws
```

## Configuration

Configuration for all required modules can be specified in the "bitcoreWalletService" section of `bitcore.config.json`. Config references: [bws.example.config.js](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/bws.example.config.js) and [config.ts](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/config.ts).


```json
{
  "bitcoreWalletService": {
    ...
  }
}
```


BWS is composed of 6 separate services
- **Bitcore Wallet Service**: bws.ts
- **Message Broker**: messagebroker/messagebroker.ts
- **Blockchain Monitor**: bcmonitor/bcmonitor.ts (This service talks to the Blockchain Explorer service configured under blockchainExplorerOpts - see Configure blockchain service below.)
- **Email Service**: emailservice/emailservice.ts
- **Push Notification Service**: pushnotificationservice/pushnotificationservice.ts
- **Fiat Rate Service**: fiatrateservice/fiatrateservice.ts

### Configure MongoDB

Example configuration for connecting to the MongoDB instance:

```json
// bitcore.config.json
{
  "bitcoreWalletService": {
    "storageOpts": {
      "mongoDb": {
        "uri": "mongodb://localhost:27017/bws"
      }
    }
  }
}
```

### Configure Message Broker service

Example configuration for connecting to message broker service:

```json
// bitcore.config.json
{
  "bitcoreWalletService": {
    "messageBrokerOpts": {
      "messageBrokerServer": {
        "uri": "http://localhost:3380"
      }
    }
  }
}
```

### Configure blockchain service. Bitcore v8 is required.

Note: this service will be used by blockchain monitor service as well as by BWS itself.
An example of this configuration is:

```json
// bitcore.config.json
{
  "bitcoreWalletService": {
    "allowRegtest": false, // set to true and add a regtest object below if you wish to support a local regtest
    "blockchainExplorerOpts": {
      "btc": {
        "livenet": {
          "url": "https://api.bitcore.io"
        },
        "testnet": {
          "url": "https://api.bitcore.io"
        }
      },
      "eth": {
        "livenet": {
          "url": "https://api-eth.bitcore.io"
        }
      }
    }
  }
}
```

### Configure Email service

Example configuration for connecting to email service (using postfix):

```javascript
  emailOpts: {
    host: 'localhost',
    port: 25,
    ignoreTLS: true,
    subjectPrefix: '[Wallet Service]',
    from: 'wallet-service@bitcore.io',
  }
```