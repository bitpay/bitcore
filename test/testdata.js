var fs = require('fs');

var dataValid = JSON.parse(fs.readFileSync('test/data/base58_keys_valid.json'));
var dataInvalid = JSON.parse(fs.readFileSync('test/data/base58_keys_invalid.json'));
var dataEncodeDecode = JSON.parse(fs.readFileSync('test/data/base58_encode_decode.json'));
var dataTxValid = JSON.parse(fs.readFileSync('test/data/tx_valid.json'));
var dataTxInvalid = JSON.parse(fs.readFileSync('test/data/tx_invalid.json'));
var dataScriptValid = JSON.parse(fs.readFileSync('test/data/script_valid.json'));
var dataScriptInvalid = JSON.parse(fs.readFileSync('test/data/script_invalid.json'));
var dataUnspent = JSON.parse(fs.readFileSync('test/data/unspent.json'));
var dataUnspentSign = JSON.parse(fs.readFileSync('test/data/unspentSign.json'));
var dataSigCanonical = JSON.parse(fs.readFileSync('test/data/sig_canonical.json'));
var dataSigNonCanonical = JSON.parse(fs.readFileSync('test/data/sig_noncanonical.json'));
var dataBase58KeysValid = JSON.parse(fs.readFileSync('test/data/base58_keys_valid.json'));
var dataBase58KeysInvalid = JSON.parse(fs.readFileSync('test/data/base58_keys_invalid.json'));
var dataSighash = JSON.parse(fs.readFileSync('test/data/sighash.json'));
var dataSecp256k1 = JSON.parse(fs.readFileSync('test/data/secp256k1.json'));

module.exports.dataValid = dataValid;
module.exports.dataInvalid = dataInvalid;
module.exports.dataEncodeDecode = dataEncodeDecode;
module.exports.dataTxValid = dataTxValid;
module.exports.dataTxInvalid = dataTxInvalid;
module.exports.dataScriptValid = dataScriptValid;
module.exports.dataScriptInvalid = dataScriptInvalid;
module.exports.dataScriptAll = dataScriptValid.concat(dataScriptInvalid);
module.exports.dataUnspent = dataUnspent;
module.exports.dataUnspentSign = dataUnspentSign;
module.exports.dataSigCanonical = dataSigCanonical;
module.exports.dataSigNonCanonical = dataSigNonCanonical;
module.exports.dataBase58KeysValid = dataBase58KeysValid;
module.exports.dataBase58KeysInvalid = dataBase58KeysInvalid;
module.exports.dataSighash = dataSighash;
module.exports.dataSecp256k1 = dataSecp256k1;

var buffer = new Buffer(fs.readFileSync('test/data/blk86756-testnet.dat'));
module.exports.dataRawBlock = buffer;
  
