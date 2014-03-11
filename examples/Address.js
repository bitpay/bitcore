'use strict';

// Replace '..' with 'bitcore' if you plan on using this code elsewhere.

var Address = require('../Address');

var addrs = [
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx',
  'A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '1600 Pennsylvania Ave NW',
].map(function(addr) {
  return new Address(addr);
});

addrs.forEach(function(addr) {
  var valid = addr.isValid();
  console.log(addr.data + ' is ' + (valid ? '' : 'not ') + 'valid');
});
