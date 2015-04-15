#!/usr/bin/env node

var ExpressApp = require('./lib/expressapp');
var WsApp = require('./lib/wsapp');
var config = require('./config');

var port = process.env.BWS_PORT || config.port || 3232;

var app = ExpressApp.start(config);
//app.listen(port);

var server = require('http').Server(app);

var ws = WsApp.start(server, config);

server.listen(port);

console.log('Bitcore Wallet Service running on port ' + port);
