'use strict';
var async = require('async');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));

var storageService = require('./lib/services/storage');
var p2pService = require('./lib/services/p2p');
var syncService = require('./lib/services/sync');

async.series([
  storageService.start.bind(storageService),
  p2pService.start.bind(p2pService),
  syncService.start.bind(syncService)
], function(){
  var router = require('./lib/routes');
  app.use(router);
  var server = app.listen(3000, function() {
    console.log('api server listening on port 3000!');
  });
  server.timeout = 600000;
});

