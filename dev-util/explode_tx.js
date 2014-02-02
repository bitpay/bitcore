#!/usr/bin/env node
'use strict';

var util = require('util');
var mongoose= require('mongoose'),
  config  = require('../config/config');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var T = require('../app/models/TransactionOut');


// var hash = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';
var hash = process.argv[2] || '6749762ae220c10705556799dcec9bb6a54a7b881eb4b961323a3363b00db518';




mongoose.connect(config.db);

mongoose.connection.on('error', function(err) { console.log(err); });


mongoose.connection.on('open', function() {

  var b = new Buffer(hash,'hex');

  T.createFromTxs([hash], function(err, ret) {

    console.log('Err:');
    console.log(err);


    console.log('Ret:');
    console.log(util.inspect(ret,{depth:null}));
    mongoose.connection.close();
  });
});



