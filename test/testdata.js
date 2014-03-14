var fs = require('fs');

var dataValid = JSON.parse(fs.readFileSync('test/data/base58_keys_valid.json'));
var dataInvalid = JSON.parse(fs.readFileSync('test/data/base58_keys_invalid.json'));
var dataEncodeDecode = JSON.parse(fs.readFileSync('test/data/base58_encode_decode.json'));
var dataTxValid = JSON.parse(fs.readFileSync('test/data/tx_valid.json'));
var dataTxInvalid = JSON.parse(fs.readFileSync('test/data/tx_invalid.json'));
var dataScriptValid = JSON.parse(fs.readFileSync('test/data/script_valid.json'));
var dataScriptInvalid = JSON.parse(fs.readFileSync('test/data/script_invalid.json'));
var dataUnspends = JSON.parse(fs.readFileSync('test/data/unspends.json'));
 

module.exports.dataValid = dataValid;
module.exports.dataInvalid = dataInvalid;
module.exports.dataEncodeDecode = dataEncodeDecode;
module.exports.dataTxValid = dataTxValid;
module.exports.dataTxInvalid = dataTxInvalid;
module.exports.dataScriptValid = dataScriptValid;
module.exports.dataScriptInvalid = dataScriptInvalid;
module.exports.dataScriptAll = dataScriptValid.concat(dataScriptInvalid);
module.exports.dataUnspends = dataUnspends;
