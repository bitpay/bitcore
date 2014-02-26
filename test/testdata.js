

var fs = require('fs');

var dataValid = JSON.parse(fs.readFileSync('test/data/base58_keys_valid.json'));
var dataInvalid = JSON.parse(fs.readFileSync('test/data/base58_keys_invalid.json'));
var dataEncodeDecode = JSON.parse(fs.readFileSync('test/data/base58_encode_decode.json'));

module.exports.dataValid = dataValid;
module.exports.dataInvalid = dataInvalid;
module.exports.dataEncodeDecode = dataEncodeDecode;
