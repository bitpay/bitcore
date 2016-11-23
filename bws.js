#!/usr/bin/env node

var async = require('async');
var fs = require('fs');

var ExpressApp = require('./lib/expressapp');
var config = require('./config');
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
  if (config.ciphers) {
    serverOpts.ciphers = config.ciphers;
    serverOpts.honorCipherOrder = true;
  };

  // This sets the intermediate CA certs only if they have all been designated in the config.js
  if (config.CAinter1 && config.CAinter2 && config.CAroot) {
    serverOpts.ca = [fs.readFileSync(config.CAinter1),
      fs.readFileSync(config.CAinter2),
      fs.readFileSync(config.CAroot)
    ];
  };
}

if (config.cluster && !config.lockOpts.lockerServer)
  throw 'When running in cluster mode, locker server need to be configured';

if (config.cluster && !config.messageBrokerOpts.messageBrokerServer)
  throw 'When running in cluster mode, message broker server need to be configured';

var expressApp = new ExpressApp();

function startInstance(cb) {
  var server = config.https ? serverModule.createServer(serverOpts, expressApp.app) : serverModule.Server(expressApp.app);

  server.on('connection', function(socket) {
    socket.setTimeout(300 * 1000);
  })

  expressApp.start(config, function(err) {
    if (err) {
      log.error('Could not start BWS instance', err);
      return cb(err);
    }

    server.listen(port);
    return cb();
  });
};


var logStart = function(err) {
  if (err) {
    log.error('Error:' + err);
    return;
  }

  if (cluster.worker)
    log.info('BWS Instance ' + cluster.worker.id + ' running');
  else
    log.info('BWS running');
};


if (config.cluster) {

  if (cluster.isMaster) {

    // Count the machine's CPUs
    var instances = config.clusterInstances || require('os').cpus().length;

    log.info('Starting ' + instances + ' instances on port:' + port);

    // Create a worker for each CPU
    for (var i = 0; i < instances; i += 1) {
      cluster.fork();

      // Listen for dying workers
      cluster.on('exit', function(worker) {
        // Replace the dead worker,
        log.error('Worker ' + worker.id + ' died :(');
        cluster.fork();
      });
    }
    // Code to run if we're in a worker process
  } else {
    startInstance(logStart);
  }
} else {
  log.info('Starting on port: ' + port);
  startInstance(logStart);
};
