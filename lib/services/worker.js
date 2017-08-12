'use strict';

var cluster = require('cluster');

var _ = require('underscore');
var async = require('async');

var config = require('../config');

var Worker = function(){
  this.workers = [];
};

Worker.prototype.start = function(ready){
  var self = this;
  if(cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    cluster.on('exit', function(worker) {
      console.log(`worker ${worker.process.pid} died`);
    });
    async.times(config.numWorkers, function(n, cb){
      var newWorker = cluster.fork();
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
  var worker = _.findWhere(this.workers, {active: false});
  worker.worker.once('message', function(result) {
    worker.active = false;
    done(result.error);
  });
  worker.active = true;
  worker.worker.send({task: task, argument: argument});
};

Worker.prototype.workerCount = function(){
  return this.workers.length;
};

module.exports = new Worker();