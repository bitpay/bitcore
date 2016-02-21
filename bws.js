#!/usr/bin/env node

var async = require('async');
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
  serverOpts.ciphers = 'ECDHE-RSA-AES256-SHA:AES256-SHA:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM';
  serverOpts.honorCipherOrder = true;
  // This sets the intermediate CA certs only if they have all been designated in the config.js
  if (config.CAinter1 && config.CAinter2 && config.CAroot) {
    serverOpts.ca = [fs.readFileSync(config.CAinter1),
      fs.readFileSync(config.CAinter2),
      fs.readFileSync(config.CAroot)
    ];
  };
}

var start = function(cb) {
  var expressApp = new ExpressApp();
  var wsApp = new WsApp();

  function doStart(cb) {
    var server = config.https ? serverModule.createServer(serverOpts, expressApp.app) : serverModule.Server(expressApp.app);
    async.parallel([

      function(done) {
        expressApp.start(config, done);
      },
      function(done) {
        wsApp.start(server, config, done);
      },
    ], function(err) {
      if (err) {
        log.error('Could not start BWS instance', err);
      }
      if (cb) return cb(err);
    });

    return server;
  };

  if (config.cluster) {
    var server = sticky(clusterInstances, function() {
      return doStart();
    });
    return cb(null, server);
  } else {
    var server = doStart(function(err) {
      return cb(err, server);
    });
  }
};

if (config.cluster && !config.lockOpts.lockerServer)
  throw 'When running in cluster mode, locker server need to be configured';

if (config.cluster && !config.messageBrokerOpts.messageBrokerServer)
  throw 'When running in cluster mode, message broker server need to be configured';

start(function(err, server) {
  if (err) {
    console.log('Could not start BWS:', err);
    process.exit(0);
  }
  server.listen(port, function(err) {
    if (err) console.log('ERROR: ', err);
    log.info('Bitcore Wallet Service running on port ' + port);
  });
});
