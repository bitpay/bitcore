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

A Full Bcoin node will start in console.

http://localhost:3000

### Configuration

A configuration object exists in /config/index.js

Bcoin accepts a config object per Bcoin docs. Same for Mongo/Mongoose

### Resetting Application State
```
mongo
use bitcore
db.blocks.drop()
db.transactions.drop()

Ctrl+D out of mongo

rm -rf ${bcoin-prefix-in-config.js}/chain.ldb
```
