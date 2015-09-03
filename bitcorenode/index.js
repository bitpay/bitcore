'use strict';

var util = require('util');
var fs = require('fs');
var async = require('async');
var path = require('path');
var bitcore = require('bitcore');
var Networks = bitcore.Networks;
var mkdirp = require('mkdirp');
var child_process = require('child_process');
var spawn = child_process.spawn;
var EventEmitter = require('events').EventEmitter;
var baseConfig = require('../config');

var Service = function(options) {
  EventEmitter.call(this);

  this.node = options.node;
  this.children = [];
};

util.inherits(Service, EventEmitter);

Service.dependencies = ['bitcoind', 'db', 'address', 'insight-api'];

Service.prototype.blockHandler = function(block, add, callback) {
  setImmediate(function() {
    callback(null, []);
  });
};

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

  var services = [
    ['locker.log', 'locker/locker.js'],
    ['messagebroker.log', 'messagebroker/messagebroker.js'],
    ['bcmonitor.log', 'bcmonitor/bcmonitor.js',  JSON.stringify(baseConfig)],
    ['emailservice.log', 'emailservice/emailservice.js', JSON.stringify(baseConfig)],
    ['bws.log', 'bws.js',  JSON.stringify(baseConfig)],
  ];

  var basePath = path.resolve(__dirname, '..');
  var logBasePath = path.resolve(self.node.datadir, './bws-logs/');

  // Make sure that the logs directory exists
  if (!fs.existsSync(logBasePath)) {
    mkdirp.sync(logBasePath);
  }

  async.eachSeries(
    services,
    function(service, next) {

      var logPath = path.resolve(logBasePath, service[0]);
      var servicePath = path.resolve(basePath, service[1]);
      var config = service[2];

      var stderr = fs.openSync(logPath, 'a+');
      var stdout = stderr;

      var options = {
        stdio: ['ignore', stdout, stderr],
        cwd: basePath,
        env: process.env
      };

      var child = spawn('node', [servicePath, config], options);
      self.children.push(child);
      next();
    },
    function(err) {
      if (err) {
        return done(err);
      }
      done();
    }
  );

};

Service.prototype.stop = function(done) {
  var self = this;
  async.eachSeries(
    self.children,
    function(child, next) {
      child.kill();
      next();
    },
    function(err) {
      if (err) {
        return done(err);
      }
      done();
    }
  );
};

Service.prototype.getAPIMethods = function() {
  return [];
};

Service.prototype.getPublishEvents = function() {
  return [];
};


Service.prototype.setupRoutes = function(app) {
  // TODO: Run bws express/websocket app (setup routes and events on the web service)
};

module.exports = Service;
