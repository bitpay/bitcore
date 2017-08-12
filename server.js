'use strict';
var async = require('async');
var cluster = require('cluster');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));

var config = require('./lib/config');
var storageService = require('./lib/services/storage');
var workerService = require('./lib/services/worker');
var p2pService = require('./lib/services/p2p');
var syncService = require('./lib/services/sync');

async.series([
  storageService.start.bind(storageService),
  workerService.start.bind(workerService),
  p2pService.start.bind(p2pService),
  syncService.start.bind(syncService)
], function(){
  if(cluster.isWorker) {
    var router = require('./lib/routes');
    app.use(router);
    var server = app.listen(config.port, function() {
      console.log('api server listening on port 3000!');
    });
    server.timeout = 600000;
  }
});

