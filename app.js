#!/usr/bin/env node

var ExpressApp = require('./lib/expressapp');

var port = process.env.COPAY_PORT || 3001;

var app = ExpressApp.start();
app.listen(port);

console.log('Bitcore Wallet Service running on port ' + port);
