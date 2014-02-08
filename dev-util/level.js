#!/usr/bin/env node 
'use strict';

var config      = require('../config/config'),
    levelup     = require('levelup');



var s       = process.argv[2];
var isBlock = process.argv[3] === '1';


var dbPath = config.leveldb + (isBlock ? '/blocks' : '/txs');
console.log('DB: ',dbPath); //TODO



var db = levelup(dbPath );


db.createReadStream({start: s, end: s+'~'})
  .on('data', function (data) {
    console.log(data.key + ' => ' + data.value); //TODO
  })
  .on('error', function () {
  })
  .on('end', function () {
  });


