# Bitcore - Bcoin - Insight
Rebuilt Bitcore with Bcoin engine and Insight API sitting on top of Mongo.

### Requirements
Mongodo running on your system.

node >=7.6.0 - This requirement comes from Bcoin. Developed under 8.2.0.

### Usage
```
npm install
npm start
```

A Full Bcoin node will start. As blocks come in they will be stored in Mongo.

### Configuration

A configuration object exists in /config/index.js that accepts a config for Bcoin, Mongo and the new insight-api. During dev this is included. As a best practice this should be part of the gitignore to prevent anyone from saving credentials to Github. However, credentials should be ENV VARS anyway.

### Misc Gotchas / Needs Docs & clarity

Mongo will create the bitcore db and a blocks/transactions collection automatically. These collectionss have indexes. Bcoin also syncs to the prefix set in config. To reset/start over you need to drop both collections and delete the bcoin datadir.

```
mongo
use bitcore
db.blocks.drop()
db.transactions.drop()

rm -rf ~/.bcoin/chain.ldb
```

### Nginx

The API is configured to run on port 3000 by default. Use the standard Nginx reverse proxy to flip http to https and handle ssl certs.

### Priorities
1. Required Insight-UI

* /addr/:addrStr/?noTxList=1
* X /block/:blockhash
* X /blocks
* X /block-index/:blockHeight
* X /currency
* X /version
* /status
* /sync
* X /peer
* X /tx/:txId
* /txs
* /txs

* sockets

# ToDo
* Mongo Models : Bcoin primitives. A Bcoin block does not present all of bitcore's data.
* Reorg testing - Bcoin will handle this but we need to account for this in our mongo indexes.
* JSDoc & Unit tests
* Rate Limiting
* Helmet
* Rate Limiting
* Sanitize user input - mongo and api params. Just make a quick middleware