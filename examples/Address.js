

// Replace path '..' to 'bitcore' if you are using this example
// in a different project
var Address = require('../Address').class();

var addrStrings = [
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx",
  "A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx",
  "1600 Pennsylvania Ave NW",
];

addrStrings.forEach(function(addrStr){
  var addr = new Address(addrStr);

  try {
    addr.validate();
    console.log(addr.data + ": is valid");
  } catch(e) {
    console.log(addr.data + ": is not a valid address. " + e);
  }
});
