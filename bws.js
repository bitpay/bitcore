#!/usr/bin/env node

var fs = require('fs');

var ExpressApp = require('./lib/expressapp');
var WsApp = require('./lib/wsapp');
var config = require('./config');
var sticky = require('sticky-session');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();




var port = process.env.BWS_PORT || config.port || 3232;

var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;
var clusterInstances = config.clusterInstances || numCPUs;
var serverModule = config.https ? require('https') : require('http');

var serverOpts = {};

if (config.https) {
  serverOpts.key = fs.readFileSync(config.privateKeyFile || './ssl/privatekey.pem');
  serverOpts.cert = fs.readFileSync(config.certificateFile || './ssl/certificate.pem');
}

var start = function() {
  var server;

  if (config.cluster) {
    server = sticky(clusterInstances, function() {
      var app = ExpressApp.start(config);
      var server = config.https ? serverModule.createServer(serverOpts, app) :
        serverModule.Server(app);
      WsApp.start(server, config);
      return server;
    });
  } else {
    var app = ExpressApp.start(config);
    server = config.https ? serverModule.createServer(serverOpts, app) :
      serverModule.Server(app);
    WsApp.start(server, config);
  }
  server.listen(port, function(err) {
    if (err) console.log('ERROR: ', err);
    log.info('Bitcore Wallet Service running on port ' + port);
  });
};

if (config.cluster && (!config.storageOpts.multiLevel || !config.lockOpts.lockerServer))
  throw 'When running in cluster mode, multilevel and locker server need to be configured';

start();
