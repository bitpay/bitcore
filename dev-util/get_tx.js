#!/usr/bin/env node
'use strict';

var util = require('util');
var T = require('../app/models/Transaction').class();
var mongoose= require('mongoose'),
  config  = require('../config/config');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


// var hash = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';
var hash = process.argv[2] || 'e2253359458db3e732c82a43fc62f56979ff59928f25a2df34dfa443e9a41160';




mongoose.connect(config.db);
mongoose.connection.on('error', function(err) { console.log('error!', err); });
mongoose.connection.on('open', function() {

  T.fromIdWithInfo(hash, function(err, ret) {

    console.log('Err:');
    console.log(err);


    console.log('Ret:');
    console.log(util.inspect(ret,{depth:null}));
    mongoose.connection.close();
  });
});



