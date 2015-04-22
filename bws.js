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

var start = function(cb) {
  var server;

  if (config.cluster) {
    server = sticky(clusterInstances, function() {
      ExpressApp.start(config, function(err, app) {
        var server = config.https ? serverModule.createServer(serverOpts, app) :
          serverModule.Server(app);
        WsApp.start(server, config);
        return server;
      });
    });
    return cb(server);
  } else {
    ExpressApp.start(config, function(err, app) {
      server = config.https ? serverModule.createServer(serverOpts, app) :
        serverModule.Server(app);
      WsApp.start(server, config);
      return cb(server);
    });
  };
};

if (config.cluster && !config.lockOpts.lockerServer)
  throw 'When running in cluster mode, locker server need to be configured';

start(function(server) {
  server.listen(port, function(err) {
    if (err) console.log('ERROR: ', err);
    log.info('Bitcore Wallet Service running on port ' + port);
  });
});
