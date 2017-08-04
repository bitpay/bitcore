# Bcoin - Bitcore - Insight
Rebuilt Bitcore with Bcoin engine and Insight API sitting on top of Mongo.

# Requirements
Mongodo running on your system.

PR has been submitted to Bcoin repo to fix a bug in their script library that is causing our sync process to crash when one of their checks to a tx script assesses if this is a pay to pubkey input. This is Bcoin-specific and should not affect syncing via DC Pool

# Usage
npm install
npm start

Logging is current defaulting to debug during dev. Bitcore logging is preceded by a timestamp. Bcoin logging with [info]

# Misc Gotchas / Needs Docs & clarity

Mongo will create the bitcore db and a blocks/transactions collection automatically. These colls have indexes. Bcoin also syncs to the prefix set in config. To reset/start over you need to drop both collections and delete the bcoin datadir.

# Nginx

The API is configured to run on port 3000 by default. Use the standard Nginx reverse proxy to flip http to https and handle ssl certs.

# Requirements

1. git clone
2. npm install
3. npm run start
4. Bitcore starts, Bcoin syncs and Insight starts automagically.

1, 2 & 3 are complete. 4 is also complete but insight still needs wired to mongo and the mongo data models are going to undergo more changes as we consolidate work and discover needs. The goal is still to go as far as possible with a stable framework and fill in the rest afterwards when work can be tasked/delegated.

# Priorities
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