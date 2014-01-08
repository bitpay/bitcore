#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_BLOCK = '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';

var 
  mongoose= require('mongoose'),
  assert  = require('assert'),
  config      = require('../../config/config'),
  Block       = require('../../app/models/Block');

mongoose.connect(config.db);

var db    = mongoose.connection;

describe('getInfo', function(){

  var block_hash  = TESTING_BLOCK;


  db.on('error', console.error.bind(console, 'connection error:'));

  db.once('open', function (){


    var block2 = Block.fromHashWithInfo(block_hash, function(err, b2) {
      if (err) done(err);

      console.log("Block obj:");
      console.log(b2);
      console.log("Block.info:");
      console.log(b2.info);
      db.close();
      done();
    });

  });
});

