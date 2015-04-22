'use strict';

var LevelStorage = require('../lib/storage_leveldb');
var MongoStorage = require('../lib/storage');


var level = new LevelStorage({
  dbPath: './db/bws.db',
});

var mongo = new MongoStorage();
mongo.connect({
  host: 'localhost',
  port: '27017'
}, function(err) {
  if (err) throw err;
  mongo.db.dropDatabase(function(err) {
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
});


function run(cb) {
  level.db.readStream()
    .on('data', function(data) {
      migrate(data.key, data.value, function(err) {
        if (err) throw err;
      });
    })
    .on('error', function(err) {
      return cb(err);
    })
    .on('end', function() {
      return cb();
    });
};

function migrate(key, value, cb) {
  if (key.match(/^copayer!/)) {
    value.copayerId = key.substring(key.indexOf('!') + 1);
    mongo.db.collection('copayers_lookup').insert(value, cb);
  } else if (key.match(/!addr!/)) {
    value.walletId = key.substring(2, key.indexOf('!addr'));
    mongo.db.collection('addresses').insert(value, cb);
  } else if (key.match(/!not!/)) {
    mongo.db.collection('notifications').insert(value, cb);
  } else if (key.match(/!p?txp!/)) {
    value.isPending = key.indexOf('!ptxp!') != -1;
    mongo.db.collection('txs').insert(value, cb);
  } else if (key.match(/!main$/)) {
    mongo.db.collection('wallets').insert(value, cb);
  } else {
    return cb(new Error('Invalid key ' + key));
  }
};
