# Insight

Insight is an open-source bitcoin blockchain explorer with complete REST
and websocket APIs. Insight runs in NodeJS, and uses AngularJS for the
front-end and LevelDB for storage.


## Prerequisites

* **Node.js v0.10.x** - Download and Install [Node.js](http://www.nodejs.org/download/).
You can also follow [this gist](https://gist.github.com/isaacs/579814)
for a quick and easy way to install Node.js and npm. If you use Ubuntu:

```
git clone git@github.com:joyent/node.git
cd node
git checkout v0.10.24
./configure
make
make install
```

* **bitcoind** - Download and Install [Bitcoin](http://bitcoin.org/en/download)

Configure bitcoind to listen to RPC calls and set `txindex` to true.
The easiest way to do this is by copying `./etc/bitcoind/bitcoin.conf` to your
bitcoin data directory (usually `"~/.bitcoin"` on Linux, `"%appdata%\Bitcoin\"` on Windows, 
and `"~/Library/Application Support/Bitcoin"` on Mac OS X).

bitcoind must be running and must have finished downloading the blockchain *BEFORE* running Insight.

* **NPM** - Node.js package manager, should be automatically installed when you get node.js.

## Quick Install
  To install Insight, clone the main repository:

    $ git clone git@github.com:bitpay/insight.git && cd insight

  Install dependencies:

    $ npm install
    
  Run the main application:

    $ node insight.js

  Then open a browser and go to:

    http://localhost:3000

  Please note that the app will need to sync its internal database
  with the blockchain state, which may take some time. You can check
  sync progress from within the web interface.
   

## Configuration
All configuration is specified in the [config](config/) folder, particularly the [config.js](config/config.js) file. Here you can specify your application name and database name.

### bitcoind

There is a bitcoind configuration sample at:
```
etc/bitcoind/bitcoin.conf
```

If you need to use a custom bitcoind server set the following environment variables:
```
BITCOIND_HOST         # RPC bitcoind host
BITCOIND_PORT         # RPC bitcoind Port
BITCOIND_P2P_PORT     # P2P bitcoind Port
BITCOIND_USER         # RPC username
BITCOIND_PASS         # RPC password
BITCOIND_DATADIR      # bitcoind datadir for livenet, or datadir/testnet3 for testnet
INSIGHT_NETWORK [= 'livenet' | 'testnet']
```

If you use this option, make sure that bitcoind is configured to accept incoming connections using 'rpcallowip' as described in https://en.bitcoin.it/wiki/Running_Bitcoin. 

Alternatively, change `config/env/$NODE_ENV.js`

In case the network is changed, levelDB database needs to be deleted. This can be performed running:
```util/sync.js -D```
and waiting for Insight to synchronize again. 
Once the database is deleted, the process can be safely interrupted (CTRL+C) and continued from the synchronization process embedded in main app.


## Environment Variables Settings

There are three environments provided by default, __development__, __test__, and __production__.

To run with a different environment, just specify NODE_ENV (development mode is default):

	$ NODE_ENV=development node insight.js

### Development environment
To run insight locally for development with grunt:

  $ NODE_ENV=development grunt

To compile and minify the web application's assets:

```grunt compile```

To run the tests

```grunt test```

### Production environment

You can use [pm2](https://github.com/Unitech/pm2) to manage the NodeJS app in production:

  $ npm install pm2 -g
  $ pm2 start insight.js

[forever] (https://github.com/nodejitsu/forever) can also be used for this purpose.

Set these environment variables to your __.bashrc__ profile:

```
export NODE_ENV=production
export BITCOIND_USER=<user>
export BITCOIND_PASS=<pass>
export BITCOIND_HOST=<host>
export BITCOIND_PORT=8332
export BITCOIND_P2P_PORT=8333
export BITCOIND_DATADIR="</path/to/bitcoin/data/>"
export INSIGHT_NETWORK='livenet'
```

For run insight in production server with the livenet mode:

	$ node insight.js

For run insight in production but with testnet mode in same server:

	$ INSIGHT_NETWORK=‘testnet’ node insight.js
	
Note: Insight livenet run by default in port __3000__. Testnet in port __3001__.

## DB storage requirement

To store the blockchain and address related information, Insight uses LevelDB. Two DBs are created: txs and blocks. By default these are
stored on <insight root>/db (this can be changed on config/config.js).

As of February 2014, storing the blockchain takes ~31Gb of disk space on levelDB,
and Insight needs ~10 minutes to complete the syncronization process on testnet.

## Syncing old blockchain data

  Old blockchain data can be manually synced from Insight:

    $ utils/sync.js -S

  Check utils/sync.js --help for options, particulary -D to erase the current DB.

  *NOTE* that there is no need to run this manually since the historic syncronization is embedded on the web application, so by running you will trigger the historic sync automatically.


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
  "hash":"000000004a3d187c430cd6a5e988aca3b19e1f1d1727a50dead6c8ac26899b96",
  "time":1389789343,
  ...
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
