'use strict';

var Message = require('./message');
var BloomFilter = require('../bloomfilter');

var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferUtil = bitcore.util.buffer;
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;
var utils = require('./utils');

function builder(options) {
  /* jshint maxstatements: 150 */
  /* jshint maxcomplexity: 10 */

  if (!options) {
    options = {};
  }

  var magicNumber = options.magicNumber;
  if (!magicNumber) {
    magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);
  }
  var Block = options.Block || bitcore.Block;
  var BlockHeader = options.BlockHeader || bitcore.BlockHeader;
  var Transaction = options.Transaction || bitcore.Transaction;
  var MerkleBlock = options.MerkleBlock || bitcore.MerkleBlock;
  var protocolVersion = options.protocolVersion || 70000;

  var commands = {};

  var exported = {
    constructors: {
      Block: Block,
      BlockHeader: BlockHeader,
      Transaction: Transaction,
      MerkleBlock: MerkleBlock
    },
    defaults: {
      protocolVersion: protocolVersion,
      magicNumber: magicNumber
    },
    commands: commands
  };

  commands.version = require('./commands/version')(options);
  commands.verack = require('./commands/verack')(options);
  commands.ping = require('./commands/ping')(options);

  /* pong */

  commands.pong = function(options) {
    Message.call(this, options);
    this.command = 'pong';
    this.magicNumber = magicNumber;
    this.nonce = options.nonce;
  };
  inherits(commands.pong, Message);

  commands.pong.fromObject = function(obj) {
    return new commands.pong(obj);
  };

  commands.pong.fromBuffer = function(payload) {
    var obj = {};
    var parser = new BufferReader(payload);
    obj.nonce = parser.read(8);

    utils.checkFinished(parser);
    return commands.pong.fromObject(obj);
  };

  commands.pong.prototype.getPayload = function() {
    return this.nonce;
  };

  commands.block = require('./commands/block')(options);

  /* tx */

  commands.tx = function(options) {
    Message.call(this, options);
    this.command = 'tx';
    this.magicNumber = magicNumber;
    this.transaction = options.transaction;
  };
  inherits(commands.tx, Message);

  commands.tx.fromObject = function(options) {
    return new commands.tx(options);
  };

  commands.tx.fromBuffer = function(payload) {
    var transaction;
    if (Transaction.prototype.fromBuffer) {
      transaction = Transaction().fromBuffer(payload);
    } else {
      transaction = Transaction.fromBuffer(payload);
    }
    return commands.tx.fromObject({transaction: transaction});
  };

  commands.tx.prototype.getPayload = function() {
    return this.transaction.toBuffer();
  };

  /* getdata */

  commands.getdata = function(options) {
    Message.call(this, options);
    this.command = 'getdata';
    this.magicNumber = magicNumber;
    this.inventory = options.inventory;
  };

  inherits(commands.getdata, Message);

  commands.getdata.fromObject = function(options) {
    return new commands.getdata(options);
  };

  commands.getdata.fromBuffer = function(payload) {
    var obj = {
      inventory: []
    };

    var parser = new BufferReader(payload);
    var count = parser.readVarintNum();
    for (var i = 0; i < count; i++) {
      var type = parser.readUInt32LE();
      var hash = parser.read(32);
      obj.inventory.push({type: type, hash: hash});
    }

    utils.checkFinished(parser);
    return commands.getdata.fromObject(obj);
  };

  commands.getdata.prototype.getPayload = function() {
    var bw = new BufferWriter();
    utils.writeInventory(this.inventory, bw);
    return bw.concat();
  };

  /**
   * Sent in response to a `getheaders` message. It contains information about
   * block headers.
   *
   * @param{Array} blockheaders - array of block headers
   */
  commands.headers = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'headers';
    this.headers = options.headers;
  };
  inherits(commands.headers, Message);

  commands.headers.fromObject = function(options) {
    return new commands.headers(options);
  };

  commands.headers.fromBuffer = function(payload) {
    var obj = {};

    $.checkArgument(payload && payload.length > 0, 'No data found to create Headers message');
    var parser = new BufferReader(payload);
    var count = parser.readVarintNum();

    obj.headers = [];
    for (var i = 0; i < count; i++) {
      var header = BlockHeader.fromBufferReader(parser);
      obj.headers.push(header);
      var txn_count = parser.readUInt8();
      $.checkState(txn_count === 0, 'txn_count should always be 0');

    }
    utils.checkFinished(parser);

    return commands.headers.fromObject(obj);
  };

  commands.headers.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeVarintNum(this.headers.length);
    for (var i = 0; i < this.headers.length; i++) {
      var buffer = this.headers[i].toBuffer();
      bw.write(buffer);
      bw.writeUInt8(0);
    }
    return bw.concat();
  };

  /* notfound */

  commands.notfound = function(options) {
    Message.call(this, options);
    this.command = 'notfound';
    this.magicNumber = magicNumber;
    this.inventory = options.inventory;
  };
  inherits(commands.notfound, Message);

  commands.notfound.fromObject = function(options) {
    return new commands.notfound(options);
  };

  commands.notfound.fromBuffer = function(payload) {
    var obj = {
      inventory: []
    };

    var parser = new BufferReader(payload);
    var count = parser.readVarintNum();
    for (var i = 0; i < count; i++) {
      var type = parser.readUInt32LE();
      var hash = parser.read(32);
      obj.inventory.push({type: type, hash: hash});
    }

    utils.checkFinished(parser);
    return commands.notfound.fromObject(obj);

  };

  commands.notfound.prototype.getPayload = function() {
    var bw = new BufferWriter();
    utils.writeInventory(this.inventory, bw);
    return bw.concat();
  };

  /* inv */

  commands.inv = function(options) {
    Message.call(this, options);
    this.command = 'inv';
    this.magicNumber = magicNumber;
    this.inventory = options.inventory;
  };

  inherits(commands.inv, Message);

  commands.inv.fromObject = function(options) {
    return new commands.inv(options);
  };

  commands.inv.prototype.getPayload = function() {
    var bw = new BufferWriter();
    utils.writeInventory(this.inventory, bw);
    return bw.concat();
  };

  commands.inv.fromBuffer = function(payload) {
    var obj = {
      inventory: []
    };

    var parser = new BufferReader(payload);
    var count = parser.readVarintNum();
    for (var i = 0; i < count; i++) {
      var type = parser.readUInt32LE();
      var hash = parser.read(32);
      obj.inventory.push({type: type, hash: hash});
    }

    utils.checkFinished(parser);
    return commands.inv.fromObject(obj);
  };

  /* addr */

  commands.addr = function(options) {
    Message.call(this, options);
    this.command = 'addr';
    this.magicNumber = magicNumber;
    this.addresses = options.addresses;
  };
  inherits(commands.addr, Message);

  commands.addr.fromObject = function(options) {
    return new commands.addr(options);
  };

  commands.addr.fromBuffer = function(payload) {
    var parser = new BufferReader(payload);

    var addrCount = parser.readVarintNum();

    var obj = {};
    obj.addresses = [];
    for (var i = 0; i < addrCount; i++) {
      // todo: time only available on versions >=31402
      var time = new Date(parser.readUInt32LE() * 1000);

      var addr = utils.parseAddr(parser);
      addr.time = time;
      obj.addresses.push(addr);
    }

    utils.checkFinished(parser);
    return commands.addr.fromObject(obj);
  };

  commands.addr.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeVarintNum(this.addresses.length);

    for (var i = 0; i < this.addresses.length; i++) {
      var addr = this.addresses[i];
      bw.writeUInt32LE(addr.time.getTime() / 1000);
      utils.writeAddr(addr, bw);
    }

    return bw.concat();
  };

  /* alert */

  commands.alert = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'alert';

    this.payload = options.payload || new Buffer(32);
    this.signature = options.signature || new Buffer(32);

  };
  inherits(commands.alert, Message);

  commands.alert.fromObject = function(options) {
    return new commands.alert(options);
  };

  commands.alert.fromBuffer = function(payload) {
    var obj = {};
    var parser = new BufferReader(payload);
    obj.payload = parser.readVarLengthBuffer();
    obj.signature = parser.readVarLengthBuffer();
    utils.checkFinished(parser);
    return commands.alert.fromObject(obj);
  };

  commands.alert.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeVarintNum(this.payload.length);
    bw.write(this.payload);

    bw.writeVarintNum(this.signature.length);
    bw.write(this.signature);

    return bw.concat();
  };

  /* reject */
  // todo: add payload: https://en.bitcoin.it/wiki/Protocol_documentation#reject
  commands.reject = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'reject';
  };
  inherits(commands.reject, Message);

  commands.reject.fromObject = function(options) {
    return new commands.reject(options);
  };

  commands.reject.fromBuffer = function(payload) {
    var obj = {};
    return commands.reject.fromObject(obj);
  };

  commands.reject.prototype.getPayload = function() {
    return BufferUtil.EMPTY_BUFFER;
  };

  /**
   * Contains information about a MerkleBlock
   *
   * @name P2P.Message.MerkleBlock
   * @param {MerkleBlock} block
   */
  commands.merkleblock = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'merkleblock';
    $.checkArgument(
      _.isUndefined(options.merkleBlock) ||
        options.merkleBlock instanceof MerkleBlock
    );
    this.merkleBlock = options.merkleBlock;
  };
  inherits(commands.merkleblock, Message);

  commands.merkleblock.fromObject = function(options) {
    return new commands.merkleblock(options);
  };

  commands.merkleblock.fromBuffer = function(payload) {
    var obj = {};
    $.checkArgument(BufferUtil.isBuffer(payload));
    obj.merkleBlock = MerkleBlock.fromBuffer(payload);
    return commands.merkleblock.fromObject(obj);
  };

  commands.merkleblock.prototype.getPayload = function() {
    return this.merkleBlock ? this.merkleBlock.toBuffer() : BufferUtil.EMPTY_BUFFER;
  };

  /* filterload */

  commands.filterload = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'filterload';
    $.checkArgument(_.isUndefined(options.filter) || options.filter instanceof BloomFilter,
                    'BloomFilter object  or undefined required for FilterLoad');
    this.filter = options.filter;
  };
  inherits(commands.filterload, Message);

  commands.filterload.fromObject = function(options) {
    return new commands.filterload(options);
  };

  commands.filterload.fromBuffer = function(payload) {
    var obj = {};
    obj.filter = BloomFilter.fromBuffer(payload);
    return commands.filterload.fromObject(obj);
  };

  commands.filterload.prototype.getPayload = function() {
    if(this.filter) {
      return this.filter.toBuffer();
    } else {
      return BufferUtil.EMPTY_BUFFER;
    }
  };

  /**
   * Request peer to add data to a bloom filter already set by 'filterload'
   *
   * @name P2P.Message.filteradd
   * @param{Buffer} data - Array of bytes representing bloom filter data
   */
  commands.filteradd = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'filteradd';
    this.data = options.data || BufferUtil.EMPTY_BUFFER;
  };
  inherits(commands.filteradd, Message);

  commands.filteradd.fromObject = function(options) {
    return new commands.filteradd(options);
  };

  commands.filteradd.fromBuffer = function(payload) {
    var obj = {};
    $.checkArgument(payload);
    var parser = new BufferReader(payload);
    obj.data = parser.readVarLengthBuffer();
    utils.checkFinished(parser);
    return commands.filteradd.fromObject(obj);
  };

  commands.filteradd.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeVarintNum(this.data.length);
    bw.write(this.data);
    return bw.concat();
  };

  /* filterclear */

  commands.filterclear = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'filterclear';
  };
  inherits(commands.filterclear, Message);

  commands.filterclear.fromObject = function(options) {
    return new commands.filterclear(options);
  };

  commands.filterclear.fromBuffer = function(payload) {
    return commands.filterclear.fromObject({});
  };

  commands.filterclear.prototype.getPayload = function() {
    return BufferUtil.EMPTY_BUFFER;
  };

  /**
   * Query another peer about blocks. It can query for multiple block hashes,
   * and the response will contain all the chains of blocks starting from those
   * hashes.
   *
   * @param{Array} starts - array of buffers or strings with the starting block hashes
   * @param{Buffer} [stop] - hash of the last block
   */
  commands.getblocks = function(options) {
    Message.call(this, options);
    this.command = 'getblocks';
    this.version = protocolVersion;
    this.magicNumber = magicNumber;

    options = utils.sanitizeStartStop(options);
    this.starts = options.starts;
    this.stop = options.stop;

  };
  inherits(commands.getblocks, Message);

  commands.getblocks.fromObject = function(obj) {
    return new commands.getblocks(obj);
  };

  commands.getblocks.fromBuffer = function(payload) {
    var obj = {};
    var parser = new BufferReader(payload);
    $.checkArgument(!parser.finished(), 'No data received in payload');

    obj.version = parser.readUInt32LE();
    var startCount = parser.readVarintNum();

    obj.starts = [];
    for (var i = 0; i < startCount; i++) {
      obj.starts.push(parser.read(32));
    }
    obj.stop = parser.read(32);
    utils.checkFinished(parser);
    return commands.getblocks.fromObject(obj);
  };

  commands.getblocks.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeUInt32LE(this.version);
    bw.writeVarintNum(this.starts.length);
    for (var i = 0; i < this.starts.length; i++) {
      bw.write(this.starts[i]);
    }
    if (this.stop.length !== 32) {
      throw new Error('Invalid hash length: ' + this.stop.length);
    }
    bw.write(this.stop);
    return bw.concat();
  };

  /**
   * Request block headers starting from a hash
   *
   * @param{Array} starts - array of buffers with the starting block hashes
   * @param{Buffer} [stop] - hash of the last block
   */
  //todo: need test data
  commands.getheaders = function(options) {
    Message.call(this, options);
    this.command = 'getheaders';
    this.version = protocolVersion;
    this.magicNumber = magicNumber;

    options = utils.sanitizeStartStop(options);
    this.starts = options.starts;
    this.stop = options.stop;

  };
  inherits(commands.getheaders, Message);

  commands.getheaders.fromObject = function(obj) {
    return new commands.getheaders(obj);
  };

  commands.getheaders.fromBuffer = function(payload) {
    var obj = {};
    var parser = new BufferReader(payload);
    $.checkArgument(!parser.finished(), 'No data received in payload');

    obj.version = parser.readUInt32LE();
    var startCount = Math.min(parser.readVarintNum(), 500);

    obj.starts = [];
    for (var i = 0; i < startCount; i++) {
      obj.starts.push(parser.read(32));
    }
    obj.stop = parser.read(32);
    utils.checkFinished(parser);
    return commands.getheaders.fromObject(obj);
  };

  commands.getheaders.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeUInt32LE(this.version);
    bw.writeVarintNum(this.starts.length);
    for (var i = 0; i < this.starts.length; i++) {
      bw.write(this.starts[i]);
    }
    if (this.stop.length !== 32) {
      throw new Error('Invalid hash length: ' + this.stop.length);
    }
    bw.write(this.stop);
    return bw.concat();
  };

  /* mempool */
  commands.mempool = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'mempool';
  };
  inherits(commands.mempool, Message);

  commands.mempool.fromObject = function(options) {
    return new commands.mempool(options);
  };

  commands.mempool.fromBuffer = function(payload) {
    return commands.mempool.fromObject({});
  };

  commands.mempool.prototype.getPayload = function() {
    return BufferUtil.EMPTY_BUFFER;
  };

  /* getaddr */
  commands.getaddr = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'getaddr';
  };
  inherits(commands.getaddr, Message);

  commands.getaddr.fromObject = function(options) {
    return new commands.getaddr(options);
  };

  commands.getaddr.fromBuffer = function(payload) {
    var obj = {};
    return commands.getaddr.fromObject(obj);
  };

  commands.getaddr.prototype.getPayload = function() {
    return BufferUtil.EMPTY_BUFFER;
  };

  return exported;

}

module.exports = builder;
