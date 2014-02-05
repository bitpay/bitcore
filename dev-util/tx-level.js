#!/usr/bin/env node 

var 
    config      = require('../config/config'),
    levelup     = require('levelup');


db = levelup(config.leveldb + '/txs');

var s = 'txouts-addr-mgqvRGJMwR9JU5VhJ3x9uX9MTkzTsmmDgQ';
db.createReadStream({start: s, end: s+'~'})
  .on('data', function (data) {
console.log('[block-level.js.11:data:]',data); //TODO
    if (data==false) c++;
  })
  .on('end', function () {
  });


