'use strict';

//Load configurations
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


/**
 * Main application entry file.
 */


//Initializing system variables
var config = require('./config/config');

//Bootstrap db connection
var db = mongoose.connect(config.db);

//Bootstrap models
var models_path = __dirname + '/app/models';
var walk = function(path) {
  fs.readdirSync(path).forEach(function(file) {
    var newPath = path + '/' + file;
    var stat = fs.statSync(newPath);
    if (stat.isFile()) {
      if (/(.*)\.(js$|coffee$)/.test(file)) {
        require(newPath);
      }
    } else if (stat.isDirectory()) {
      walk(newPath);
    }
  });
};
walk(models_path);

// historic_sync process
if (!config.disableHistoricSync) {
  var hs = new HistoricSync();
  hs.init({
    skip_db_connection: true,
    networkName: config.network
  }, function() {
    hs.smart_import(function(err){
      var txt= 'ended.';
      if (err) txt = 'ABORTED with error: ' + err.message;

      console.log('[historic_sync] ' + txt, hs.syncInfo);
    });
  });
}


// p2p_sync process
if (!config.disableP2pSync) {
  var ps = new PeerSync();
  ps.init({
    skip_db_connection: true,
    broadcast_txs: true,
    broadcast_blocks: true
  }, function() {
    ps.run();
  });
}

// express app
/*global app: true*/
var app = express();

//express settings
require('./config/express')(app, db);

//Bootstrap routes
require('./config/routes')(app);

// socket.io
var server = require('http').createServer(app);
var ios = require('socket.io').listen(server);
require('./app/controllers/socket.js').init(app,ios);

//Start the app by listening on <port>
var port = process.env.PORT || config.port;
server.listen(port, function(){
    console.log('Express server listening on port %d in %s mode', server.address().port, process.env.NODE_ENV);
});

//expose app
exports = module.exports = app;
