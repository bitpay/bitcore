#!/usr/bin/env node

'use strict';

var MQ = require('../lib/messagequeue');

var DEFAULT_PORT = 3380;

var opts = {
  port: parseInt(process.argv[2]) || DEFAULT_PORT,
};

MQ.start(opts, function(err) {
  if (err) throw err;
  console.log('Message queue server listening on port ' + port)
});
