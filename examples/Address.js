'use strict';

// Replace '..' with 'bitcore' if you plan on using this code elsewhere.

var Address = require('../Address');

var addrStrings = [
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx",
  "A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx",
  "1600 Pennsylvania Ave NW",
].map(function(addr) {
  return new Address(addr);
});

addrStrings.forEach(function(addr) {

  try {
    addr.validate();
    console.log(addr.data + ": is valid");
  } catch(e) {
    console.log(addr.data + ": is not a valid address. " + e);
  }

});
