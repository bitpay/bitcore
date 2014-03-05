var imports    = require('soop').imports();
var base58     = imports.base58 || require('base58-native').base58Check;
var parent     = imports.parent || require('./EncodedData');


function VersionedData(version, payload) {
  if(typeof version != 'number') {
    VersionedData.super(this, arguments);
    return;
  };
  this.data = new Buffer(payload.length + 1);
  this.__proto__ = this.encodings['binary'];
  this.version(version);
  this.payload(payload);
};

VersionedData.parent = parent;
parent.applyEncodingsTo(VersionedData);

// get or set the version data (the first byte of the address)
VersionedData.prototype.version = function(num) {
  if(num || (num === 0)) {
    this.doAsBinary(function() {this.data.writeUInt8(num, 0);});
    return num;
  }
  return this.as('binary').readUInt8(0);
};

// get or set the payload data (as a Buffer object)
VersionedData.prototype.payload = function(data) {
  if(data) {
    this.doAsBinary(function() {data.copy(this.data,1);});
    return data;
  }
  return this.as('binary').slice(1);
};

module.exports = require('soop')(VersionedData);
