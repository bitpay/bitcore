const BlockModel = require('../../models/block');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config     = require('../../config');
const util       = require('../../lib/util');
const logger     = require('../logger');

function parse(entry, block) {
  const rawBlock  = block.toRaw().toString('hex');
  const blockJSON = block.toJSON();
  const reward    = util.calcBlockReward(entry.height);

  // Can probably use destructuring to build something nicer
  const newBlock = new BlockModel({
    hash:       blockJSON.hash,
    height:     entry.height,
    size:       block.getSize(),
    version:    blockJSON.version,
    prevBlock:  blockJSON.prevBlock,
    merkleRoot: blockJSON.merkleRoot,
    ts:         blockJSON.ts,
    bits:       blockJSON.bits,
    nonce:      blockJSON.nonce,
    txs:        block.txs.map((tx) => {
      const txJSON = tx.toJSON();
      const txRAW  = tx.toRaw();
      return {
        hash:        txJSON.hash,
        witnessHash: txJSON.witnessHash,
        fee:         txJSON.fee,
        rate:        txJSON.rate,
        size:        txRAW.length,
        ps:          txJSON.ps,
        height:      entry.height,
        block:       util.revHex(entry.hash),
        ts:          entry.ts,
        date:        txJSON.date,
        index:       txJSON.index,
        version:     txJSON.version,
        flag:        txJSON.flag,
        inputs:      tx.inputs.map((input) => {
          const inputJSON = input.toJSON();
          return new InputModel({
            prevout:  inputJSON.prevout,
            script:   inputJSON.script,
            witness:  inputJSON.witness,
            sequence: inputJSON.sequence,
            address:  inputJSON.address,
          });
        }),
        outputs: tx.outputs.map((output) => {
          const outputJSON = output.toJSON();
          return new OutputModel({
            address: outputJSON.address,
            script:  outputJSON.script,
            value:   outputJSON.value,
          });
        }),
        lockTime: txJSON.locktime,
        chain: config.bcoin.network,
      };
    }),
    chainwork:  entry.chainwork,
    reward,
    network:    config.bcoin.network,
    poolInfo:   {},
    rawBlock,
  });

  newBlock.save((err) => {
    if (err) {
      logger.log('error', err.message);
    }
  });
}
// Fill in behind blocks and update tx inputs
function updateInputs(txid, address) {
  // Use txid and output address to get value
  // Get addr / value from prev out
  // update input

}

module.exports = {
  parse,
};
