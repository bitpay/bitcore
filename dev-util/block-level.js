#!/usr/bin/env node 

var 
    config      = require('../config/config'),
    levelup     = require('levelup');


db = levelup(config.leveldb + '/blocks');

db.createReadStream({start: 'b-'})
  .on('data', function (data) {
console.log('[block-level.js.11:data:]',data); //TODO
    if (data==false) c++;
  })
  .on('error', function (err) {
    return cb(err);
  })
  .on('close', function () {
    return cb(null);
  })
  .on('end', function () {
    return cb(null);
  });


