'use strict';

var LevelStorage = require('../lib/storage_leveldb');
var MongoStorage = require('../lib/storage');
var Bitcore = require('bitcore-lib');

var level = new LevelStorage({
  dbPath: './db',
});

var mongo = new MongoStorage();
mongo.connect({
    mongoDb: {
      uri: 'mongodb://localhost:27017/bws',
    }
  },
  function(err) {
    if (err) throw err;
    run(function(err) {
      if (err) throw err;
      console.log('All data successfully migrated');
      process.exit(0);
      // mongo._dump(function() {
      //   process.exit(0);
      // });
    });
  });


function run(cb) {
  var pending = 0,
    ended = false;
  level.db.readStream()
    .on('data', function(data) {
      pending++;
      migrate(data.key, data.value, function(err) {
        if (err) throw err;
        pending--;
        if (pending == 0 && ended) {
          return cb();
        }
      });
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      console.log('All old data read')
      ended = true;
      if (!pending) {
        return cb();
      }
    });
};

function migrate(key, value, cb) {
  if (key.match(/^copayer!/)) {
    value.copayerId = key.substring(key.indexOf('!') + 1);
    mongo.db.collection('copayers_lookup').insert(value, cb);
  } else if (key.match(/!addr!/)) {
    value.walletId = key.substring(2, key.indexOf('!addr'));
    value.network = Bitcore.Address(value.address).toObject().network;
    mongo.db.collection('addresses').insert(value, cb);
  } else if (key.match(/!not!/)) {
    mongo.db.collection('notifications').insert(value, cb);
  } else if (key.match(/!p?txp!/)) {
    value.isPending = key.indexOf('!ptxp!') != -1;
    value.network = Bitcore.Address(value.toAddress).toObject().network;
    mongo.db.collection('txs').insert(value, cb);
  } else if (key.match(/!main$/)) {
    mongo.db.collection('wallets').insert(value, cb);
  } else {
    return cb(new Error('Invalid key ' + key));
  }
};
