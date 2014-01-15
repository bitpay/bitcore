#! /usr/bin/env node

'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

require('buffertools').extend();

var SYNC_VERSION = '0.1';
var program = require('commander');
var Sync = require('../lib/Sync').class();
var async = require('async');

program
  .version(SYNC_VERSION)
  .option('-N --network [livenet]', 'Set bitcoin network [testnet]', 'testnet')
  .option('-D --destroy', 'Remove current DB (and start from there)', '0')
  .option('--skip_blocks', 'Sync blocks')
  .option('--skip_txs', 'Sync transactions')
  .parse(process.argv);

var sync = new Sync({
  networkName: program.network
});

if (program.remove) {

}

async.series([
function(cb) {
  sync.init(program);
  cb();
},
function(cb) {
  sync.import_history(program, function(err, count) {
    if (err) {
      console.log('CRITICAL ERROR: ', err);
    }
    else {
      console.log('Done! [%d blocks]', count);
    }
    cb();
  });
},
function(cb) {
  sync.close();
  cb();
}]);

