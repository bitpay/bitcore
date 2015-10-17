'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Service = function(options) {
  EventEmitter.call(this);

  this.node = options.node;
  this.name = options.name;
};

util.inherits(Service, EventEmitter);

/**
 * Describes the dependencies that should be loaded before this service.
 */
Service.dependencies = [];

/**
 * blockHandler
 * @param {Block} block - the block being added or removed from the chain
 * @param {Boolean} add - whether the block is being added or removed
 * @param {Function} callback - call with the leveldb database operations to perform
 */
Service.prototype.blockHandler = function(block, add, callback) {
  // implement in the child class
  setImmediate(function() {
    callback(null, []);
  });
};

/**
 * the bus events available for subscription
 * @return {Array} an array of event info
 */
Service.prototype.getPublishEvents = function() {
  // Example:
  // return [
  //   ['eventname', this, this.subscribeEvent, this.unsubscribeEvent],
  // ];
  return [];
};

/**
 * the API methods to expose
 * @return {Array} return array of methods
 */
Service.prototype.getAPIMethods = function() {
  // Example:
  // return [
  //   ['getData', this, this.getData, 1]
  // ];

  return [];
};

// Example:
// Service.prototype.getData = function(arg1, callback) {
//
// };

/**
 * Function which is called when module is first initialized
 */
Service.prototype.start = function(done) {
  setImmediate(done);
};

/**
 * Function to be called when bitcore-node is stopped
 */
Service.prototype.stop = function(done) {
  setImmediate(done);
};

/**
 * Setup express routes
 * @param  {Express} app
 */
Service.prototype.setupRoutes = function(app) {
  // Setup express routes here
};

Service.prototype.getRoutePrefix = function() {
  return this.name;
};



module.exports = Service;
