'use strict';

var cluster = require('cluster');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var async = require('async');

var config = require('../config');

var Worker = function(){
  this.workers = [];
};

util.inherits(Worker, EventEmitter);

Worker.prototype.start = function(ready){
  var self = this;
  if(cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    cluster.on('exit', function(worker) {
      console.log(`worker ${worker.process.pid} died`);
    });
    async.times(config.numWorkers, function(n, cb){
      var newWorker = cluster.fork();
      newWorker.on('message', function(msg){
        self.emit(msg.id, msg);
      });
      self.workers.push({worker: newWorker, active: false});
      setTimeout(cb, 3000);
    }, function(){
      ready();
    });
  }
  if(cluster.isWorker) {
    console.log(`Worker ${process.pid} started`);
    setImmediate(ready);
  }
};

Worker.prototype.stop = function(){

};

Worker.prototype.sendTask = function(task, argument, done){
  this.workers.push(this.workers.shift());
  var worker = this.workers[0];
  var id = (Date.now() * Math.random()).toString();
  this.once(id, function(result) {
    done(result.error);
  });
  worker.worker.send({task: task, argument: argument, id: id});
};

Worker.prototype.workerCount = function(){
  return this.workers.length;
};

module.exports = new Worker();