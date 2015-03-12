'use strict';

var bitcore = require('bitcore');

function builder(options) {
  /* jshint maxstatements: 50 */
  /* jshint maxcomplexity: 8 */

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
  commands.pong = require('./commands/pong')(options);
  commands.block = require('./commands/block')(options);
  commands.tx = require('./commands/tx')(options);
  commands.getdata = require('./commands/getdata')(options);
  commands.headers = require('./commands/headers')(options);
  commands.notfound = require('./commands/notfound')(options);
  commands.inv = require('./commands/inv')(options);
  commands.addr = require('./commands/addr')(options);
  commands.alert = require('./commands/alert')(options);
  commands.reject = require('./commands/reject')(options);
  commands.merkleblock = require('./commands/merkleblock')(options);
  commands.filterload = require('./commands/filterload')(options);
  commands.filteradd = require('./commands/filteradd')(options);
  commands.filterclear = require('./commands/filterclear')(options);
  commands.getblocks = require('./commands/getblocks')(options);
  commands.getheaders = require('./commands/getheaders')(options);
  commands.mempool = require('./commands/mempool')(options);
  commands.getaddr = require('./commands/getaddr')(options);

  return exported;

}

module.exports = builder;
