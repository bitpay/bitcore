'use strict';

var bitcore = require('bitcore');
var $ = bitcore.util.preconditions;
var BufferUtil = bitcore.util.buffer;
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var _ = bitcore.deps._;

function Inventory(obj) {
  this.type = obj.type;
  if (!BufferUtil.isBuffer(obj.hash)) {
    throw new TypeError('Unexpected hash, expected to be a buffer');
  }
  this.hash = obj.hash;
}

Inventory.forItem = function(type, hash) {
  $.checkArgument(hash);
  //todo: is reversing expected behavior?
  if (_.isString(hash)) {
    hash = new Buffer(hash, 'hex');
    hash = BufferUtil.reverse(hash);
  }
  return new Inventory({type: type, hash: hash});
};

Inventory.forBlock = function(hash) {
  return Inventory.forItem(Inventory.TYPE.BLOCK, hash);
};

Inventory.forFilteredBlock = function(hash) {
  return Inventory.forItem(Inventory.TYPE.FILTERED_BLOCK, hash);
};

Inventory.forTransaction = function(hash) {
  return Inventory.forItem(Inventory.TYPE.TX, hash);
};

Inventory.prototype.toBuffer = function() {
  var bw = new BufferWriter();
  bw.writeUInt32LE(this.type);
  bw.write(this.hash);
  return bw.concat();
};

Inventory.prototype.toBufferWriter = function(bw) {
  bw.writeUInt32LE(this.type);
  bw.write(this.hash);
  return bw;
};

Inventory.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var obj = {};
  obj.type = parser.readUInt32LE();
  obj.hash = parser.read(32);
  return new Inventory(obj);
};

Inventory.fromBufferReader = function(br) {
  var obj = {};
  obj.type = br.readUInt32LE();
  obj.hash = br.read(32);
  return new Inventory(obj);
};

// https://en.bitcoin.it/wiki/Protocol_specification#Inventory_Vectors
Inventory.TYPE = {};
Inventory.TYPE.ERROR = 0;
Inventory.TYPE.TX = 1;
Inventory.TYPE.BLOCK = 2;
Inventory.TYPE.FILTERED_BLOCK = 3;
Inventory.TYPE_NAME = [
  'ERROR',
  'TX',
  'BLOCK',
  'FILTERED_BLOCK'
];

module.exports = Inventory;
