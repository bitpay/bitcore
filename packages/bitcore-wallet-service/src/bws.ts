#!/usr/bin/env node

var async = require('async');
var fs = require('fs');

var ExpressApp = require('./lib/expressapp');
var config = require('./config');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();
var Common = require('./lib/common');
var Defaults = Common.Defaults;





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

  expressApp.start(config, function(err) {
    if (err) {
      log.error('Could not start BWS instance', err);
      return;
    }

    server.listen(port);

    var instanceInfo = cluster.worker ? ' [Instance:' + cluster.worker.id + ']' : '';
    log.info('BWS running ' + instanceInfo);
    return;
  });
};

if (config.cluster && cluster.isMaster) {

  // Count the machine's CPUs
  var instances = config.clusterInstances || require('os').cpus().length;

  log.info('Starting ' + instances + ' instances');

  // Create a worker for each CPU
  for (var i = 0; i < instances; i += 1) {
    cluster.fork();
  }

  // Listen for dying workers
  cluster.on('exit', function(worker) {
    // Replace the dead worker,
    log.error('Worker ' + worker.id + ' died :(');
    cluster.fork();
  });
  // Code to run if we're in a worker process
} else {
  log.info('Listening on port: ' + port);
  startInstance();
};
