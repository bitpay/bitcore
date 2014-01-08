#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

require('buffertools').extend();

var SYNC_VERSION     = '0.1';
var program          = require('commander');
var Sync             = require('../Sync').class();

program
	.version(SYNC_VERSION)
	.option('-N --network [livenet]', 'Set bitcoin network [testnet]', 'testnet')
	.option('-R --reindex', 'Force reindexing', '0')
	.option('-D --destroy', 'Remove current DB', '0')
	.option('--skip_blocks', 'Sync blocks')
	.option('--skip_txs', 'Sync transactions')
	.parse(process.argv);

var sync = new Sync({ networkName: program.network });

if (program.remove) {

}

sync.start( program, function(err){
  if (err) {
    console.log("CRITICAL ERROR: ", err);
  }
  else {
    console.log('Done!');
  }
});

