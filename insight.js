'use strict';

//Set the node enviornment variable if not set before
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Module dependencies.
 */
var express = require('express'),
  fs = require('fs'),
  PeerSync = require('./lib/PeerSync').class(),
  HistoricSync = require('./lib/HistoricSync').class(),
  mongoose = require('mongoose');


//Initializing system variables
var config = require('./config/config');

/**
 * express app
 */
var expressApp = express();

/**
 * Bootstrap db connection
 */
// If mongod is running
mongoose.connection.on('open', function() {
  console.log('Connected to mongo server.');
});

// If mongod is not running
mongoose.connection.on('error', function(err) {
  console.log('Could not connect to mongo server!');
  console.log(err);
});

mongoose.connect(config.db);

/**
 * Bootstrap models
 */
var models_path = __dirname + '/app/models';
var walk = function(path) {
  fs.readdirSync(path).forEach(function(file) {
    var newPath = path + '/' + file;
    var stat = fs.statSync(newPath);
    if (stat.isFile()) {
      if (/(.*)\.(js$)/.test(file)) {
        require(newPath);
      }
    }
    else if (stat.isDirectory()) {
      walk(newPath);
    }
  });
};

walk(models_path);

/**
 * historic_sync process
 */
var historicSync = {};

if (!config.disableHistoricSync) {
  historicSync = new HistoricSync();

  historicSync.init({
    skipDbConnection: true,
    shouldBroadcast: true,
    networkName: config.network
  }, function(err) {
    if (err) {
      var txt = 'ABORTED with error: ' + err.message;
      console.log('[historic_sync] ' + txt);
    }
    else {
      historicSync.smartImport(function(err){
        var txt = 'ended.';
        if (err) txt = 'ABORTED with error: ' + err.message;
        console.log('[historic_sync] ' + txt, historicSync.info());
      });
    }
  });
}

/**
 * p2pSync process
 */
if (!config.disableP2pSync) {
  var ps = new PeerSync();
  ps.init({
    skipDbConnection: true,
    broadcast_txs: true,
    broadcast_address_tx: true,
    broadcast_blocks: true,
  }, function() {
    ps.run();
  });
}

//express settings
require('./config/express')(expressApp, historicSync);

//Bootstrap routes
require('./config/routes')(expressApp);

// socket.io
var server = require('http').createServer(expressApp);
var ios = require('socket.io').listen(server);
require('./app/controllers/socket.js').init(expressApp, ios);

//Start the app by listening on <port>
server.listen(config.port, function(){
    console.log('Express server listening on port %d in %s mode', server.address().port, process.env.NODE_ENV);
});

//expose app
exports = module.exports = expressApp;
