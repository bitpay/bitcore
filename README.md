# *insight*

*insight* is an open-source bitcoin blockchain explorer with complete REST
and websocket APIs. Insight runs in NodeJS, and uses AngularJS for the
front-end and LevelDB for storage.


## Prerequisites

* **bitcoind** - Download and Install [Bitcoin](http://bitcoin.org/en/download)

*insight* needs a *trusted* bitcoind node to run. *insight* will connect to the node
thru the RPC API, Peer-to-peer protocol and will even read its raw .dat files for syncing.

Configure bitcoind to listen to RPC calls and set `txindex` to true.
The easiest way to do this is by copying `./etc/bitcoind/bitcoin.conf` to your
bitcoin data directory (usually `"~/.bitcoin"` on Linux, `"%appdata%\Bitcoin\"` on Windows, 
or `"~/Library/Application Support/Bitcoin"` on Mac OS X).

bitcoind must be running and must have finished downloading the blockchain **before** running *insight*.


* **Node.js v0.10.x** - Download and Install [Node.js](http://www.nodejs.org/download/).

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

All configuration is specified in the [config](config/) folder, particularly the [config.js](config/config.js) file. There you can specify your application name and database name. Certain configuration values are pulled from environment variables is they are defined:

### bitcoind connexion
```
BITCOIND_HOST         # RPC bitcoind host
BITCOIND_PORT         # RPC bitcoind Port
BITCOIND_P2P_PORT     # P2P bitcoind Port
BITCOIND_USER         # RPC username
BITCOIND_PASS         # RPC password
BITCOIND_DATADIR      # bitcoind datadir for livenet, or datadir/testnet3 for testnet
INSIGHT_NETWORK [= 'livenet' | 'testnet']
```

Make sure that bitcoind is configured to [accept incoming connections using 'rpcallowip'] (https://en.bitcoin.it/wiki/Running_Bitcoin).

In case the network is changed (testnet or livenet), levelDB database needs to be deleted. This can be performed running:
```util/sync.js -D``` and waiting for *insight* to synchronize again.  Once the database is deleted, the sync.js process can be safely interrupted (CTRL+C) and continued from the synchronization process embedded in main app.


## Development

To run insight locally for development with grunt:

```$ NODE_ENV=development grunt```

To compile and minify the web application's assets:

```$ grunt compile```

To run the tests

```$ grunt test```


Contributions and suggestions are welcomed at [insight github repository](https://github.com/bitpay/insight).

## DB storage requirement

To store the blockchain and address related information, *insight* uses LevelDB. Two DBs are created: txs and blocks. By default these are stored on 
  ```<insight root>/db``` 
  
this can be changed on config/config.js.

As of February 2014, storing the livenet blockchain takes ~31GB of disk space on levelDB,
and takes ~8hrs. For testnet, those values are reduced to 2GB and 20 minutes respectively.

## Syncing old blockchain data manualy

  Old blockchain data can be manually synced issuing:

    $ utils/sync.js

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
