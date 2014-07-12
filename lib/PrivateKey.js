
var VersionedData = require('../util/VersionedData');
var EncodedData = require('../util/EncodedData');
var networks = require('../networks');
var util = require('util');

//compressed is true if public key is compressed; false otherwise
function PrivateKey(version, buf, compressed) {
  PrivateKey.super_.call(this, version, buf);
  if (compressed !== undefined)
    this.compressed(compressed);
};
util.inherits(PrivateKey, VersionedData);
EncodedData.applyEncodingsTo(PrivateKey);

PrivateKey.prototype.validate = function() {
  this.doAsBinary(function() {
    PrivateKey.super_.prototype.validate.call(this);
    if (this.data.length < 32 || (this.data.length > 1 + 32 && !this.compressed()) || (this.data.length == 1 + 32 + 1 && this.data[1 + 32 + 1 - 1] != 1) || this.data.length > 1 + 32 + 1)
      throw new Error('invalid data length');
  });
  if (typeof this.network() === 'undefined') throw new Error('invalid network');
};

// get or set the payload data (as a Buffer object)
// overloaded from VersionedData
PrivateKey.prototype.payload = function(data) {
  if (data) {
    this.doAsBinary(function() {
      data.copy(this.data, 1);
    });
    return data;
  }
  var buf = this.as('binary');
  if (buf.length == 1 + 32 + 1)
    return buf.slice(1, 1 + 32);
  else if (buf.length == 1 + 32)
    return buf.slice(1);
};

// get or set whether the corresponding public key is compressed
PrivateKey.prototype.compressed = function(compressed) {
  if (compressed !== undefined) {
    this.doAsBinary(function() {
      var len = 1 + 32 + 1;
      if (compressed) {
        var data = new Buffer(len);
        this.data.copy(data);
        this.data = data;
        this.data[len - 1] = 1;
      } else {
        this.data = this.data.slice(0, len - 1);
      }
    });
  } else {
    var len = 1 + 32 + 1;
    var data = this.as('binary');
    if (data.length == len && data[len - 1] == 1)
      return true;
    else if (data.length == len - 1)
      return false;
    else
      throw new Error('invalid private key');
  }
};

PrivateKey.prototype.network = function() {
  var version = this.version();

  var livenet = networks.livenet;
  var testnet = networks.testnet;

  var answer;
  if (version === livenet.privKeyVersion)
    answer = livenet;
  else if (version === testnet.privKeyVersion)
    answer = testnet;

  return answer;
};

module.exports = PrivateKey;
