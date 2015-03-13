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

  exported.commandsMap = {
    version: 'Version',
    verack: 'VerAck',
    ping: 'Ping',
    pong: 'Pong',
    block: 'Block',
    tx: 'Transaction',
    getdata: 'GetData',
    headers: 'Headers',
    notfound: 'NotFound',
    inv: 'Inventory',
    addr: 'Address',
    alert: 'Alert',
    reject: 'Reject',
    merkleblock: 'MerkleBlock',
    filterload: 'FilterLoad',
    filteradd: 'FilterAdd',
    filterclear: 'FilterClear',
    getblocks: 'GetBlocks',
    getheaders: 'GetHeaders',
    mempool: 'MemPool',
    getaddr: 'GetAddr'
  };

  for (var key in exported.commandsMap) {
    exported.commands[key] = require('./commands/' + key)(options);
  }

  return exported;

}

module.exports = builder;
