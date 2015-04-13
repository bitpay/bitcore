#!/usr/bin/env node

var PORT = 3003;

console.log('Server started at port ' + PORT + '...');
var Locker = require('locker-server'),
  locker = new Locker();

locker.listen(PORT);
