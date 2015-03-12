'use strict';

var Message = require('./message');
var BloomFilter = require('../bloomfilter');
var packageInfo = require('../../package.json');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BN = bitcore.crypto.BN;
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var BufferUtil = bitcore.util.buffer;
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;

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

  /* shared */

  function checkFinished(parser) {
    if(!parser.finished()) {
      throw new Error('Data still available after parsing');
    }
  }

  function getNonce() {
    return bitcore.crypto.Random.getRandomBuffer(8);
  }

  function writeIP(ip, bw) {
    var words = ip.v6.split(':').map(function(s) {
      return new Buffer(s, 'hex');
    });
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      bw.write(word);
    }
  }

  function writeAddr(addr, bw) {
    if (_.isUndefined(addr)) {
      var pad = new Buffer(Array(26));
      bw.write(pad);
      return;
    }

    bw.writeUInt64LEBN(addr.services);
    writeIP(addr.ip, bw);
    bw.writeUInt16BE(addr.port);
  }

  function writeInventory(inventory, bw) {
    bw.writeVarintNum(inventory.length);
    inventory.forEach(function(value) {
      bw.writeUInt32LE(value.type);
      bw.write(value.hash);
    });
  }

  function parseIP(parser) {
    var ipv6 = [];
    var ipv4 = [];
    for (var a = 0; a < 8; a++) {
      var word = parser.read(2);
      ipv6.push(word.toString('hex'));
      if (a >= 6) {
        ipv4.push(word[0]);
        ipv4.push(word[1]);
      }
    }
    ipv6 = ipv6.join(':');
    ipv4 = ipv4.join('.');
    return {
      v6: ipv6,
      v4: ipv4
    };
  }

  function parseAddr(parser) {
    var services = parser.readUInt64LEBN();
    var ip = parseIP(parser);
    var port = parser.readUInt16BE();
    return {
      services: services,
      ip: ip,
      port: port
    };
  }

  function sanitizeStartStop(obj) {
    /* jshint maxcomplexity: 10 */
    $.checkArgument(_.isUndefined(options.starts) || _.isArray(options.starts));
    var starts = obj.starts;
    var stop = obj.stop;
    if (starts) {
      starts = starts.map(function(hash) {
        if (_.isString(hash)) {
          return BufferUtil.reverse(new Buffer(hash, 'hex'));
        } else {
          return hash;
        }
      });
    } else {
      starts = [];
    }

    for (var i = 0; i < starts.length; i++) {
      if (starts[i].length !== 32) {
        throw new Error('Invalid hash ' + i + ' length: ' + starts[i].length);
      }
    }

    stop = obj.stop;
    if (_.isString(stop)) {
      stop = BufferUtil.reverse(new Buffer(stop, 'hex'));
    }
    if (!stop) {
      stop = BufferUtil.NULL_HASH;
    }
    obj.starts = starts;
    obj.stop = stop;

    return obj;
  }

  /**
   * The version message is used on connection creation to advertise
   * the type of node. The remote node will respond with its version, and no
   * communication is possible until both peers have exchanged their versions.
   * By default, bitcore advertises itself as named `bitcore:0.8`.
   *
   * @param{Object} obj - properties for the version
   * @param{String} obj.subversion - version of the client
   * @param{Buffer} obj.nonce - a random 8 byte buffer
   */
  commands.version = function(obj) {
    Message.call(this, obj);
    this.command = 'version';
    _.assign(this, obj);
    this.magicNumber = magicNumber;
    this.nonce = this.nonce || getNonce();
    this.services = this.services || new BN(1, 10);
    this.timestamp = this.timestamp || new Date();
    this.version = this.version || protocolVersion;
    this.subversion = this.subversion || '/bitcore:' + packageInfo.version + '/';
    this.startHeight = this.startHeight || 0;
  };
  inherits(commands.version, Message);

  commands.version.fromObject = function(obj) {
    return new commands.version(obj);
  };

  commands.version.fromBuffer = function(payload) {
    var parser = new BufferReader(payload);
    var obj = {};
    obj.version = parser.readUInt32LE();
    obj.services = parser.readUInt64LEBN();
    obj.timestamp = new Date(parser.readUInt64LEBN().toNumber() * 1000);

    obj.addrMe = {
      services: parser.readUInt64LEBN(),
      ip: parseIP(parser),
      port: parser.readUInt16BE()
    };
    obj.addrYou = {
      services: parser.readUInt64LEBN(),
      ip: parseIP(parser),
      port: parser.readUInt16BE()
    };
    obj.nonce = parser.read(8);
    obj.subversion = parser.readVarLengthBuffer().toString();
    obj.startHeight = parser.readUInt32LE();

    if(parser.finished()) {
      obj.relay = true;
    } else {
      obj.relay = !!parser.readUInt8();
    }
    checkFinished(parser);

    return commands.version.fromObject(obj);
  };

  commands.version.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeUInt32LE(this.version);
    bw.writeUInt64LEBN(this.services);

    var timestampBuffer = new Buffer(Array(8));
    timestampBuffer.writeUInt32LE(Math.round(this.timestamp.getTime() / 1000), 0);
    bw.write(timestampBuffer);

    writeAddr(this.addrMe, bw);
    writeAddr(this.addrYou, bw);
    bw.write(this.nonce);
    bw.writeVarintNum(this.subversion.length);
    bw.write(new Buffer(this.subversion, 'ascii'));
    bw.writeUInt32LE(this.startHeight);
    bw.writeUInt8(this.relay);

    return bw.concat();
  };

  /* verack */

  commands.verack = function(options) {
    Message.call(this, options);
    this.magicNumber = magicNumber;
    this.command = 'verack';
  };
  inherits(commands.verack, Message);

  commands.verack.fromObject = function(obj) {
    return new commands.verack(obj);
  };

  commands.verack.fromBuffer = function(payload) {
    return commands.verack.fromObject({});
  };

  commands.verack.prototype.getPayload = function() {
    return BufferUtil.EMPTY_BUFFER;
  };

  /* ping */

  commands.ping = function(options) {
    Message.call(this, options);
    this.command = 'ping';
    this.magicNumber = magicNumber;
    this.nonce = options.nonce || getNonce();
  };
  inherits(commands.ping, Message);

  commands.ping.prototype.getPayload = function() {
    return this.nonce;
  };

  commands.ping.fromObject = function(obj) {
    return new commands.ping(obj);
  };

  commands.ping.fromBuffer = function(payload) {
    var obj = {};
    var parser = new BufferReader(payload);
    obj.nonce = parser.read(8);

    checkFinished(parser);
    return commands.ping.fromObject(obj);
  };

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

    checkFinished(parser);
    return commands.pong.fromObject(obj);
  };

  commands.pong.prototype.getPayload = function() {
    return this.nonce;
  };

  /* block */

  commands.block = function(options) {
    Message.call(this, options);
    this.command = 'block';
    this.magicNumber = magicNumber;
    this.block = options.block;
  };
  inherits(commands.block, Message);

  commands.block.fromObject = function(options) {
    return new commands.block(options);
  };

  commands.block.fromBuffer = function(payload) {
    var block = Block.fromBuffer(payload);
    return commands.block.fromObject({block: block});
  };

  commands.block.prototype.getPayload = function() {
    return this.block.toBuffer();
  };

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

    checkFinished(parser);
    return commands.getdata.fromObject(obj);
  };

  commands.getdata.prototype.getPayload = function() {
    var bw = new BufferWriter();
    writeInventory(this.inventory, bw);
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
    checkFinished(parser);

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

    checkFinished(parser);
    return commands.notfound.fromObject(obj);

  };

  commands.notfound.prototype.getPayload = function() {
    var bw = new BufferWriter();
    writeInventory(this.inventory, bw);
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
    writeInventory(this.inventory, bw);
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

    checkFinished(parser);
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

      var addr = parseAddr(parser);
      addr.time = time;
      obj.addresses.push(addr);
    }

    checkFinished(parser);
    return commands.addr.fromObject(obj);
  };

  commands.addr.prototype.getPayload = function() {
    var bw = new BufferWriter();
    bw.writeVarintNum(this.addresses.length);

    for (var i = 0; i < this.addresses.length; i++) {
      var addr = this.addresses[i];
      bw.writeUInt32LE(addr.time.getTime() / 1000);
      writeAddr(addr, bw);
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
    checkFinished(parser);
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
    checkFinished(parser);
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

    options = sanitizeStartStop(options);
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
    checkFinished(parser);
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

    options = sanitizeStartStop(options);
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
    checkFinished(parser);
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
  //todo: need test data
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
