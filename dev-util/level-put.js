#!/usr/bin/env node 
'use strict';

var config      = require('../config/config'),
    levelup     = require('levelup');



var k       = process.argv[2];
var v       = process.argv[3];
var isBlock = process.argv[4] === '1';


var dbPath = config.leveldb + (isBlock ? '/blocks' : '/txs');
console.log('DB: ',dbPath); //TODO



var db = levelup(dbPath );


if (v) {
  db.put(k,v,function(err) {
      console.log('[PUT done]',err); //TODO
  });
}
else {
  db.del(k,function(err) {
      console.log('[DEL done]',err); //TODO
  });
}



