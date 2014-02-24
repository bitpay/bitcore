

var fs = require('fs');

var dataValid = JSON.parse(fs.readFileSync('test/data/base58_keys_valid.json'));
var dataInvalid = JSON.parse(fs.readFileSync('test/data/base58_keys_invalid.json'));

module.exports.dataValid = dataValid;
module.exports.dataInvalid = dataInvalid;
