

var fs = require('fs');

// Defined as global for Browser testing support
dataValid = JSON.parse(fs.readFileSync('test/data/base58_keys_valid.json'));
dataInvalid = JSON.parse(fs.readFileSync('test/data/base58_keys_invalid.json'));

module.exports.dataValid = dataValid;
module.exports.dataInvalid = dataInvalid;
