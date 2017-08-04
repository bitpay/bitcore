# Bitcore - Bcoin - Insight
Rebuilt Bitcore with Bcoin engine and Insight API sitting on top of Mongo.

### Requirements
Mongodo running on your system.

A [PR has been submitted](https://github.com/bcoin-org/bcoin/pull/264) to Bcoin repo to fix a bug in their script library that is causing our sync process to crash when one of their checks to a tx script assesses if this is a pay to pubkey input. This is Bcoin-specific and should not affect syncing via DC Pool.

### Usage
```
git clone
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

/addr/:addrStr/?noTxList=1
/block/:blockhash
/blocks
/block-index/:blockHeight
/currency
/version
/status
/sync
/peer
/tx/:txId
/txs
/txs

sockets

2. Mongo Models

Some data is stubbed. This is due to Bcoin primitives being different from Bitcore. It's unclear whether Mongo models or multiple queries at the api layer will better serve us. Obviously multiple queries are easier but I would prefer a clear cut data model because that leads to fewer problems in the future and gives us greater flexibility in our API and the other microservices we implement in the future.

# ToDo
Reorg testing - Bcoin will handle this but we need to account for this in our mongo indexes.
JSDoc & Unit tests
