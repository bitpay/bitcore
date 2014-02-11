# Insight

Insight is an open-source bitcoin blockchain explorer with complete REST
and websocket APIs. Insight runs in NodeJS, and uses AngularJS for the
front-end and LevelDB for storage.


## Prerequisites

* Node.js v0.10.x - Download and Install [Node.js](http://www.nodejs.org/download/).
You can also follow [this gist](https://gist.github.com/isaacs/579814)
for a quick and easy way to install Node.js and npm. If you use Ubuntu:

   ```git clone git@github.com:joyent/node.git && cd node && git checkout v0.10.24 && ./configure && make && make install```

* Bitcoind - Download and Install [Bitcoin](http://bitcoin.org/en/download)
- You should make sure to configure RPC security and `txindex`.
The easiest way to do this is copying `./etc/bitcoind/bitcoin.conf` to your
bitcoin directory (usually ~/.bitcoin).

- Bitcoind must be running and must have finished downloading the blockchain *BEFORE* starting Insight.

### Tools
* NPM - Node.js package manager, should be installed when you install node.js.
```

## Quick Install
  To install Insight, clone the main repository:

    $ git clone git@github.com:bitpay/insight.git && cd insight

  Install dependencies:

    $ npm install
    $ node insight.js

  Then open a browser and go to:

    http://localhost:3000
   

## Configuration
All configuration is specified in the [config](config/) folder, particularly the [config.js](config/config.js) file. Here you will need to specify your application name and database name.

### bitcoind

There is a bitcoind configuration sample at:
```
    etc/bitcoind/bitcoin.conf
```

If you need to configure bitcoind server access set the following environment variables:
```
  BITCOIND_HOST
  BITCOIND_PORT         # RPC Bitcoind Port
  BITCOIND_P2P_PORT     # P2P Bitcoind Port
  BITCOIND_USER         # RPC username
  BITCOIND_PASS         # RPC password
  BITCOIND_DATADIR      # bitcoind datadir for livenet, or datadir/testnet3 for testnet
  INSIGHT_NETWORK [= 'livenet' | 'testnet']
```

Make sure that bitcoind is configured to accept incomming connections using 'rpcallowip' decribed in https://en.bitcoin.it/wiki/Running_Bitcoin. Alternatively change config/env/$NODE_ENV.js

In case the network is changed, levelDB database need to be deleted. This can be performed running:
```
  util/sync.js -D
```
and waiting to Insight to synchronize again. The process can be interrupted and continued from the synchronization process embedded in main app insight.js safely.


### Environment Variables Settings

There are three environments provided by default, __development__, __test__, and __production__. Each of these environments has the following configuration options:

* __app.name__ - This is the name of your app or website, and can be different for each environment. You can tell which environment you are running by looking at the TITLE attribute that your app generates.

To run with a different environment, just specify NODE_ENV as you call grunt:

	$ NODE_ENV=test grunt

If you are using node instead of grunt, it is very similar:

	$ NODE_ENV=test node server


### Development environment
To run insight locally for development:

  $ NODE_ENV=development grunt

## Other utilities for development
To compile and minify the web application's assets:
```
  grunt compile
```

To run the tests
```
  grunt test
```


### Production
You can use [pm2](https://github.com/Unitech/pm2) to manage NodeJS in production:

  $ npm install pm2 -g
  $ pm2 start insight.js

[forever] (https://github.com/nodejitsu/forever) can also be used for this task.

## DB storage requirement

To store the blockchain and address related information, Insight uses LevelDB. Two DBs are created: txs and blocks. By default these are
stored on <insight root>/db (this can be changed on config/config.js).

As of February 2014, storing the blockchain takes ~31Gb of disk space on levelDB,
and Insight needs ~7hrs to complete the syncronization process.

## Syncing old blockchain data

  Old blockchain data can be synced manually from Insight (to save blocks and transactions in
  LevelDB):

  Create folders:

    $ mkdir -p db/blocks
    $ utils/sync.js -S

  Check utils/sync.js --help for options, particulary -D to erase the current DB.

  *NOTE* that there is no need to run this manually since the historic syncronization is embedded on the webserver, so running the webserver will trigger the historic sync.


## API

A REST API is provided at /api. The entry points are:


### Block
```
  /api/block/[:hash]
  /api/block/00000000a967199a2fad0877433c93df785a8d8ce062e5f9b451cd1397bdbf62
```
### Transaction
```
  /api/tx/[:txid]
  /api/tx/525de308971eabd941b139f46c7198b5af9479325c2395db7f2fb5ae8562556c
```
### Address
```
  /api/addr/[:addr]
  /api/addr/mmvP3mTe53qxHdPqXEvdu8WdC7GfQ2vmx5
```
### Transactions by Block
```
  /api/txs/?block=HASH
  /api/txs/?block=00000000fa6cf7367e50ad14eb0ca4737131f256fc4c5841fd3c3f140140e6b6
```
### Transactions by Address
```
  /api/txs/?address=ADDR
  /api/txs/?address=mmhmMNfBiZZ37g1tgg2t8DDbNoEdqKVxAL
```

### Sync status
```
  /api/sync
```

## Web Socket API
The web socket API is served using [socket.io](http://socket.io) at:
```
  /socket.io/1/
```

Bitcoin network events published are:
'tx': new transaction received from network. Data will be a app/models/Transaction object.
Sample output:
```
{
  "txid":"00c1b1acb310b87085c7deaaeba478cef5dc9519fab87a4d943ecbb39bd5b053",
  "orphaned":false,
  "processed":false
  ...
}
```


'block': new block received from network. Data will be a app/models/Block object.
Sample output:
```
{
  "__v":0,
  "hash":"000000004a3d187c430cd6a5e988aca3b19e1f1d1727a50dead6c8ac26899b96",
  "time":1389789343,
  "fromP2P":true,
}
```

'sync': every 1% increment on the sync task, this event will be triggered.

Sample output:
```
{
  blocksToSync: 164141,
  syncedBlocks: 475,
  upToExisting: true,
  scanningBackward: true,
  isEndGenesis: true,
  end: "000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943",
  isStartGenesis: false,
  start: "000000009f929800556a8f3cfdbe57c187f2f679e351b12f7011bfc276c41b6d"
}
```


## Github
[Insight](https://github.com/bitpay/insight)

## License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
