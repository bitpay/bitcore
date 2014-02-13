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
  .option('-v --verbose', 'Verbose 0/1', 0)
  .parse(process.argv);

var historicSync = new HistoricSync();

/*  TODO: Sure?
if (program.remove) {

}
*/
async.series([
  function(cb) {
    historicSync.init(program, cb);
  },
  function(cb) {
    historicSync.smartImport({
      destroy: program.destroy,
      startFile: program.startfile,
    },cb);
  },
  ],
  function(err) {
    historicSync.close();
    if (err) {
      console.log('CRITICAL ERROR: ', historicSync.info());
    }
    else {
      console.log('Finished.\n Status:\n', historicSync.info());
    }
});

