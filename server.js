'use strict';
var async = require('async');
var cluster = require('cluster');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));
// app.use('/', express.static('./node_modules/insight-ui/public'));

var config = require('./lib/config');
var storageService = require('./lib/services/storage');
var workerService = require('./lib/services/worker');
var p2pService = require('./lib/services/p2p');
var embeddedNodeService = require('./lib/services/embeddedNode');

async.series([
  storageService.start.bind(storageService),
  workerService.start.bind(workerService),
  p2pService.start.bind(p2pService),
  embeddedNodeService.start.bind(embeddedNodeService)
], function(){
  if(cluster.isWorker) {
    var router = require('./lib/routes');
    app.use('/api', router);
    var server = app.listen(config.port, function() {
      console.log('api server listening on port 3000!');
    });
    server.timeout = 600000;
  }
});

