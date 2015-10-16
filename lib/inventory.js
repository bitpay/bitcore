'use strict';

var bitcore = require('bitcore-lib');
var $ = bitcore.util.preconditions;
var BufferUtil = bitcore.util.buffer;
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var _ = bitcore.deps._;

/**
 * A constructor for inventory related Bitcoin messages such as
 * "getdata", "inv" and "notfound".
 * @param {Object} obj
 * @param {Number} obj.type - Inventory.TYPE
 * @param {Buffer} obj.hash - The hash for the inventory
 * @constructor
 */
function Inventory(obj) {
  this.type = obj.type;
  if (!BufferUtil.isBuffer(obj.hash)) {
    throw new TypeError('Unexpected hash, expected to be a buffer');
  }
  this.hash = obj.hash;
}

/**
 * A convenience constructor for Inventory.
 * @param {Number} type - Inventory.TYPE
 * @param {Buffer|String} hash - The hash for the inventory
 * @returns {Inventory} - A new instance of Inventory
 */
Inventory.forItem = function(type, hash) {
  $.checkArgument(hash);
  if (_.isString(hash)) {
    hash = new Buffer(hash, 'hex');
    hash = BufferUtil.reverse(hash);
  }
  return new Inventory({type: type, hash: hash});
};

/**
 * A convenience constructor for Inventory for block inventory types.
 * @param {Buffer|String} hash - The hash for the block inventory
 * @returns {Inventory} - A new instance of Inventory
 */
Inventory.forBlock = function(hash) {
  return Inventory.forItem(Inventory.TYPE.BLOCK, hash);
};

/**
 * A convenience constructor for Inventory for filtered/merkle block inventory types.
 * @param {Buffer|String} hash - The hash for the filtered block inventory
 * @returns {Inventory} - A new instance of Inventory
 */
Inventory.forFilteredBlock = function(hash) {
  return Inventory.forItem(Inventory.TYPE.FILTERED_BLOCK, hash);
};

/**
 * A convenience constructor for Inventory for transaction inventory types.
 * @param {Buffer|String} hash - The hash for the transaction inventory
 * @returns {Inventory} - A new instance of Inventory
 */
Inventory.forTransaction = function(hash) {
  return Inventory.forItem(Inventory.TYPE.TX, hash);
};

/**
 * @returns {Buffer} - Serialized inventory
 */
Inventory.prototype.toBuffer = function() {
  var bw = new BufferWriter();
  bw.writeUInt32LE(this.type);
  bw.write(this.hash);
  return bw.concat();
};

/**
 * @param {BufferWriter} bw - An instance of BufferWriter
 */
Inventory.prototype.toBufferWriter = function(bw) {
  bw.writeUInt32LE(this.type);
  bw.write(this.hash);
  return bw;
};

/**
 * @param {Buffer} payload - Serialized buffer of the inventory
 */
Inventory.fromBuffer = function(payload) {
  var parser = new BufferReader(payload);
  var obj = {};
  obj.type = parser.readUInt32LE();
  obj.hash = parser.read(32);
  return new Inventory(obj);
};

/**
 * @param {BufferWriter} br - An instance of BufferWriter
 */
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
