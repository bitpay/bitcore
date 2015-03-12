'use strict';

var bitcore = require('bitcore');

function builder(options) {
  /* jshint maxstatements: 20 */
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
    commands: {}
  };

  var commandsArray = [
    'version', 'verack', 'ping', 'pong', 'block', 'tx', 'getdata', 'headers', 'notfound',
    'inv', 'addr', 'alert', 'reject', 'merkleblock', 'filterload', 'filteradd', 'filterclear',
    'getblocks', 'getheaders', 'mempool', 'getaddr'
  ];

  for (var i = 0; i < commandsArray.length; i++) {
    var command = commandsArray[i];
    exported.commands[command] = require('./commands/' + command)(options);
  }

  return exported;

}

module.exports = builder;
