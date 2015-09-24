'use strict';

var util = require('util');
var fs = require('fs');
var io = require('socket.io');
var https = require('https');
var http = require('http');
var async = require('async');
var path = require('path');
var bitcore = require('bitcore');
var Networks = bitcore.Networks;
var mkdirp = require('mkdirp');
var Locker = require('locker-server');
var BlockchainMonitor = require('../lib/blockchainmonitor');
var EmailService = require('../lib/emailservice');
var ExpressApp = require('../lib/expressapp');
var WsApp = require('../lib/wsapp');
var child_process = require('child_process');
var spawn = child_process.spawn;
var EventEmitter = require('events').EventEmitter;
var baseConfig = require('../config');

var Service = function(options) {
  EventEmitter.call(this);

  this.node = options.node;
  this.https = options.https || this.node.https;
  this.httpsOptions = options.httpsOptions || this.node.httpsOptions;
  this.bwsPort = options.bwsPort || Service.BWS_PORT;
  this.messageBrokerPort = options.messageBrokerPort || Service.MESSAGE_BROKER_PORT;
  this.lockerPort = options.lockerPort || Service.LOCKER_PORT;
};

util.inherits(Service, EventEmitter);

Service.BWS_PORT = 3232;
Service.MESSAGE_BROKER_PORT = 3380;
Service.LOCKER_PORT = 3231;

Service.dependencies = ['insight-api'];

/**
 * This method will read `key` and `cert` files from disk based on `httpsOptions` and
 * return `serverOpts` with the read files.
 */
Service.prototype.readHttpsOptions = function() {
  if(!this.httpsOptions || !this.httpsOptions.key || !this.httpsOptions.cert) {
    throw new Error('Missing https options');
  }

  var serverOpts = {};
  serverOpts.key = fs.readFileSync(this.httpOptions.key);
  serverOpts.cert = fs.readFileSync(this.httpsOptions.cert);

  // This sets the intermediate CA certs only if they have all been designated in the config.js
  if (this.httpsOptions.CAinter1 && this.httpsOptions.CAinter2 && this.httpsOptions.CAroot) {
    serverOpts.ca = [
      fs.readFileSync(this.httpsOptions.CAinter1),
      fs.readFileSync(this.httpsOptions.CAinter2),
      fs.readFileSync(this.httpsOptions.CAroot)
    ];
  }
  return serverOpts;
};

/**
 * Called by the node to start the service
 */
Service.prototype.start = function(done) {

  var self = this;
  var providerOptions = {
    provider: 'insight',
    url: 'http://localhost:' + self.node.port,
    apiPrefix: '/insight-api'
  };

  // A bitcore-node is either livenet or testnet, so we'll pass
  // the configuration options to communicate via the local running
  // instance of the insight-api service.
  if (self.node.network === Networks.livenet) {
    baseConfig.blockchainExplorerOpts = {
      livenet: providerOptions
    };
  } else if (self.node.network === Networks.testnet) {
    baseConfig.blockchainExplorerOpts = {
      testnet: providerOptions
    };
  } else {
    return done(new Error('Unknown network'));
  }

  async.series([
    function(next) {
      // Locker Server
      var locker = new Locker();
      locker.listen(self.lockerPort);

      // Message Broker
      var messageServer = io(self.messageBrokerPort);
      messageServer.on('connection', function(s) {
        s.on('msg', function(d) {
          messageServer.emit('msg', d);
        });
      });

      // Blockchain Monitor
      var blockChainMonitor = new BlockchainMonitor();
      blockChainMonitor.start(baseConfig, next);
    },
    function(next) {
      if (baseConfig.emailOpts) {
        var emailService = new EmailService();
        emailService.start(baseConfig, next);
      } else {
        setImmediate(next);
      }
    },
    function(next) {

      var expressApp = new ExpressApp();
      var wsApp = new WsApp();

      if (self.https) {
        var serverOpts = self.readHttpsOptions();
        self.server = https.createServer(serverOpts, expressApp.app);
      } else {
        self.server = http.Server(expressApp.app);
      }

      async.parallel([
        function(done) {
          expressApp.start(baseConfig, done);
        },
        function(done) {
          wsApp.start(self.server, baseConfig, done);
        },
      ], function(err) {
        if (err) {
          return next(err);
        }
        self.server.listen(self.bwsPort, next);
      });

    }
  ], done);

};

/**
 * Called by node to stop the service
 */
Service.prototype.stop = function(done) {
  setImmediate(function() {
    done();
  });
};

Service.prototype.getAPIMethods = function() {
  return [];
};

Service.prototype.getPublishEvents = function() {
  return [];
};

module.exports = Service;
