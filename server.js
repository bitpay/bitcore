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

// p2p_sync process
var ps = new PeerSync();
ps.init({
  skip_db_connection: true
});
ps.run();

// express app
var app = express();

//express settings
require('./config/express')(app, db);

//Bootstrap routes
require('./config/routes')(app);

// socket.io
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
require('./app/views/sockets/main.js')(app,io);

//Start the app by listening on <port>
var port = process.env.PORT || config.port;
server.listen(port, function(){
    console.log('Express server listening on port %d in %s mode', server.address().port, process.env.NODE_ENV);
});

//expose app
exports = module.exports = app;
