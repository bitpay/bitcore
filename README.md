# Insight

Project description.  

## Prerequisites
* Node.js - Download and Install [Node.js](http://www.nodejs.org/download/). You can also follow [this gist](https://gist.github.com/isaacs/579814) for a quick and easy way to install Node.js and npm
* MongoDB - Download and Install [MongoDB](http://www.mongodb.org/downloads) - Make sure it's running on the default port (27017).

### Tools Prerequisites
* NPM - Node.js package manager, should be installed when you install node.js.
* Grunt - Download and Install [Grunt](http://gruntjs.com).
* Bower - Web package manager, installing [Bower](http://bower.io/) is simple when you have npm:

```
$ npm install -g bower
```

## Additional Packages
* Express - Defined as npm module in the [package.json](package.json) file.
* Mongoose - Defined as npm module in the [package.json](package.json) file.
* AngularJS - Defined as bower module in the [bower.json](bower.json) file.
* Twitter Bootstrap - Defined as bower module in the [bower.json](bower.json) file.
* UI Bootstrap - Defined as bower module in the [bower.json](bower.json) file.

## Quick Install
  To install Insight on local, you have to fork the main repository to your
  computer:

    https://github.com/bitpay/insight

  Then clone it wherever you want:

    $ git clone git@github.com:<your_username>/insight.git

    $ cd myster

  Install Grunt Command Line Interface:
  
    $ sudo npm -g install grunt-cli
  
  Install dependencies:

    $ npm install

  We use [Grunt](https://github.com/gruntjs/grunt-cli) to start the server:

    $ grunt
    
  When not using grunt you can use (for example in production or test
  environment):

    $ node server
    
  Then open a browser and go to (with default port):

    http://localhost:3000

  If you get an error, please check the next section "Post-install"

## Syncing old blockchain data

  Run sync from insight repository (to save old blocks and transactions in MongoDB):
    
    $ utils/sync.js

  Check utils/sync.js --help for options.

  New blockchain data will be synced while the webserver (server.js) is up, through the p2p module.


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
### Addresse
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
  "__v":0,
  "txid":"00c1b1acb310b87085c7deaaeba478cef5dc9519fab87a4d943ecbb39bd5b053",
  "_id":"52d68099c3fb4c240d000088",
  "orphaned":false,
  "processed":false
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
  "_id":"52d6809ec3fb4c240d00008c"
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

## Troubleshooting
If you did not get all library during grunt command, please use the follow command:

    $ bower install

## Configuration
All configuration is specified in the [config](config/) folder, particularly the [config.js](config/config.js) file and the [env](config/env/) files. Here you will need to specify your application name and database name.

### bitcoind

There is a bitcoind configuration sample at:
```
    etc/bitcoind/bitcoin.conf
```

If you want to use a external bitcoind server set BITCOIND_HOST / BITCOIND_PORT enviroment variables. Make sure that bitcoind is configured to accept incomming connections using 'rpcallowip' decribed in https://en.bitcoin.it/wiki/Running_Bitcoin.


### Environment Variables Settings

There are three environments provided by default, __development__, __test__, and __production__. Each of these environments has the following configuration options:
* __db__ - This is the name of the MongoDB database to use, and is set by default to __insight-dev__ for the development environment.
* __app.name__ - This is the name of your app or website, and can be different for each environment. You can tell which environment you are running by looking at the TITLE attribute that your app generates.

To run with a different environment, just specify NODE_ENV as you call grunt:

	$ NODE_ENV=test grunt

If you are using node instead of grunt, it is very similar:

	$ NODE_ENV=test node server


### Development enviroment
To run insight locally for development:

  $ NODE_ENV=development grunt


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
