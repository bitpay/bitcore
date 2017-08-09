# Bitcore - Bcoin - Insight
Rebuilt Bitcore with Bcoin engine and Insight API sitting on top of Mongo.

### Requirements
Mongodb running on your system.

node >=7.6.0 - This requirement comes from Bcoin. Developed under 8.2.0.

### Usage
```
npm install
npm start
```

http://localhost:3000

A Full Bcoin node will start in console. As blocks come in they will be stored in Mongo. You can refresh the page to see the blocks sync. When the socket portion is complete you can watch live but it may be too fast (watch console).

### Configuration

A configuration object exists in /config/index.js

Bcoin accepts a config object per Bcoin docs. Same for Mongo/Mongoose

### Misc Gotchas / Needs Docs & clarity

To reset/start over you need to drop both mongo and delete the bcoin datadir.

Bcoin offers a few database types. The most ideal for our purpose is the in memory database. Unfortunately, Bcoin will not record blockchain sync checkpoints in this mode. Every restart of the client would result in Bcoin sync'ing from the Genesis block. Long term, we should consider sending them a friendly PR that includes some sort of flat file last height persistence.

Alternatively, I've explored putting mongo into Bcoin. The db interface seems simple enough. Bcoin mostly get/puts but it is surprisingly complicated under the hood. So Bcoin creates its own leveldb for now.

### Resetting Application State
```
mongo
use bitcore
db.blocks.drop()
db.transactions.drop()

Ctrl+D out of mongo

rm -rf ~/.bcoin/chain.ldb
```

### Nginx

The API is configured to run on port 3000 by default. Use the standard Nginx reverse proxy on ports 80/443 to flip http to https and handle ssl certs.

### Priorities
https://docs.google.com/a/bit-pay.com/spreadsheets/d/1hDlf16F6zAxBrOC3ZdnvfRrSB9bvdgohf1GxAIM9_Fk/edit?usp=sharing

# ToDo but required for a release
* Finish API Endpoints (3-ish remain);
* Mongo Models : Bcoin primitives. A Bcoin block primitive does not represent all of bitcore's data.
1. scriptpubkey asm
2. peer's best block height is learned on peer connect but not retained by the app. Block height is the current sync height
3. Multiple Outputs were overlooked in the mongo model
* Post-sync listeners are not wired up yet (sockets).
* Parameters for some routes are missing. Spreadsheet is not 100% complete. Need a test run / qa round.

# ToDo but not Required for a release
* Reorg testing - Bcoin will handle this but we need to account for this in our mongo indexes.
* JSDoc & Unit tests
* Rate Limiting
* Helmet for security
* Caching
* Sanitize user input - mongo and api params. Just make a quick middleware.
* Change Mongo subdocuments into .populate Object Id relationships. This will reduce size & increase performance
* Make the current api the 'legacy' api and setup a real api with uniform verbage/params
* Remove hh:mm:ss from log file names and append to same file for the same day