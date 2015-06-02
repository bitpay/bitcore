The following document is a step-by-step guide to run BWS in cluster mode.

Configuration for all required modules can be specified in https://github.com/bitpay/bitcore-wallet-service/blob/master/config.js


###Install BWS
```bash
npm install bws
cd bws
````

###Start MongoDB
Example configuration for connecting to the MongoDB instance:
```javascript
  storageOpts: {
    mongoDb: {
      uri: 'mongodb://localhost:27017/bws',
    },
  }
```

###Start locker service
```bash
node locker/locker.js
````
Example configuration for connecting to locker service:
```javascript
  lockOpts: {
    lockerServer: {
      host: 'localhost',
      port: 3231,
    },
  }
```

###Start message broker service
```bash
node messagebroker/messagebroker.js
````
Example configuration for connecting to message broker service:
```javascript
  messageBrokerOpts: {
    messageBrokerServer: {
      url: 'http://localhost:3380',
    },
  }
```

###Configure blockchain service
Note: this service will be used by blockchain monitor service as well as by BWS itself.
An example of this configuration is:
```javascript
  blockchainExplorerOpts: {
    livenet: {
      provider: 'insight',
      url: 'https://insight.bitpay.com:443',
    },
    testnet: {
      provider: 'insight',
      url: 'https://test-insight.bitpay.com:443',
    },
  }
```


###Start blockchain monitor service
The monitor service is used to notify instances of BWS of incoming txs. It will connect to all previous services so it is important that those are already running.
```bash
node bcmonitor/bcmonitor.js
````


###Start email service
```bash
node emailservice/emailservice.js
````
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

###Enable clustering
Change `config.js` file to enable and configure clustering:
```javascript
{
  cluster: true,
  clusterInstances: 4,
}
```

###Start bws instances
```bash
npm start
````
