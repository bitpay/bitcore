'use strict';
var cluster = require('cluster');
var async = require('async');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));

var storageService = require('./lib/services/storage');
var workerService = require('./lib/services/worker');
var syncService = require('./lib/services/sync');

async.series([
  storageService.start.bind(storageService),
  workerService.start.bind(workerService),
  syncService.start.bind(syncService)
], function(){
  if(cluster.isMaster) {
    var router = require('./lib/routes');
    app.use(router);
    app.listen(3000, function() {
      console.log('api server listening on port 3000!');
    });
  }
});

