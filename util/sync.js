#!/usr/bin/env node 


'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var SYNC_VERSION = '0.1';
var program = require('commander');
var HistoricSync = require('../lib/HistoricSync').class();
var async = require('async');

program
  .version(SYNC_VERSION)
  .option('-D --destroy', 'Remove current DB (and start from there)', 0)
  .option('-S --startfile', 'Number of file from bitcoind to start(default=0)')
  .option('-R --rpc', 'Force sync with RPC')
  .option('-v --verbose', 'Verbose 0/1', 0)
  .parse(process.argv);

var historicSync = new HistoricSync({
  shouldBroadcastSync: true,
});


async.series([
  function(cb) {
    if (!program.destroy) return cb();
    console.log('Deleting Sync DB...');
    historicSync.sync.destroy(cb);
  },
  function(cb) {
    historicSync.start({
      forceStartFile: program.startfile,
      forceRPC: program.rpc,
    },cb);
  },
  ],
  function(err) {
    historicSync.close();
    if (err) console.log('CRITICAL ERROR: ', historicSync.info());
});

