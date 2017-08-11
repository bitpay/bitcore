const Block  = require('../../models/block.js');
const Transaction = require('../../models/transaction');
const logger = require('../logger');

const MAX_TXS = 20;
const MAX_BLOCKS = 1;

// Shoe horned in. Not dry, also in blocks. Make db api later
function getBlock(params, options, limit, cb) {
  const defaultOptions = { _id: 0 };

  if (!Number.isInteger(limit)) {
    limit = MAX_BLOCKS;
  }

  Object.assign(defaultOptions, options);

  Block.find(
    params,
    defaultOptions,
    cb)
    .sort({ height: -1 })
    .limit(limit);
}


function getTransactions(params, options, cb) {
  const defaultOptions = { _id: 0 };

  Object.assign(defaultOptions, options);

  Transaction.find(
    params,
    defaultOptions,
    cb)
    .sort({ height: 1 })
    .limit(MAX_TXS);
}

module.exports = function transactionAPI(router) {
  router.get('/tx/:txid', (req, res) => {
    getTransactions(
      { hash: req.params.txid },
      {  },
      (err, tx) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        if (tx[0]) {
          const t = tx[0];

          // Map bcoin model to insight-api
          res.json({
            txid: t.hash,
            version: t.version,
            locktime: t.lockTime,
            vin: t.inputs.map(input => ({
              coinbase: input.script,
              sequence: input.sequence,
              n: 0,
            })),
            vout: t.outputs.map(output => ({
              value: output.value / 1e8,
              n: 0,
              scriptPubKey: {
                hex: output.script,
                asm: '',
                addresses: [output.address],
                type: null,
              },
              spentTxId: null,
              spentIndex: null,
              spentHeight: null,
            })),
            blockhash: t.block,
            blockheight: t.height,
            confirmations: 0,
            time: 0,
            blocktime: 0,
            isCoinBase: false,
            valueOut: t.outputs.reduce((a, b) => a.value + b.value).value / 1e8,
            size: 0,
          });
        } else {
          res.send();
        }
      });
  });

  router.get('/txs', (req, res) => {
    if (req.query.block) {
      getBlock(
        { hash: req.query.block },
        { rawBlock: 0 },
        MAX_BLOCKS,
        (err, block) => {
          if (err) {
            res.status(501).send();
            logger.log('err', err);
          }
          if (block[0]) {
            const b = block[0];
            res.json({
              pagesTotal: 1,
              txs: b.txs.map(tx => ({
                txid: tx.hash,
                version: tx.version,
                locktime: tx.locktime,
                vin: tx.inputs.map(input => ({
                  coinbase: input.script,
                  sequence: input.sequence,
                  n: 0,
                  addr: input.address,
                })),
                vout: tx.outputs.map(output => ({
                  value: output.value / 1e8,
                  n: 0,
                  scriptPubKey: {
                    hex: '',
                    asm: '',
                    addresses: [output.address],
                    type: output.type,
                  },
                  spentTxid: '',
                  spentIndex: 0,
                  spentHeight: 0,
                })),
              })),
            });
          } else {
            res.send();
          }
        });
    } else if (req.query.address) {
      getBlock(
        { $or:
          [
            { 'txs.outputs.address':     req.query.address },
            { 'txs.inputs.prevout.hash': req.query.address },
          ],
        },
        { rawBlock: 0 },
        MAX_BLOCKS,
        (err, block) => {
          if (err) {
            res.status(501).send();
            logger.log('err', err);
          }

          if (block[0]) {
            const b = block[0];
            res.json({
              pagesTotal: 1,
              txs: b.txs.map(tx => ({
                txid: tx.hash,
                version: tx.version,
                locktime: tx.locktime,
                vin: tx.inputs.map(input => ({
                  coinbase: input.script,
                  sequence: input.sequence,
                  n: 0,
                  addr: input.address,
                })),
                vout: tx.outputs.map(output => ({
                  value: output.value / 1e8,
                  n: 0,
                  scriptPubKey: {
                    hex: '',
                    asm: '',
                    addresses: [output.address],
                    type: output.type,
                  },
                  spentTxid: '',
                  spentIndex: 0,
                  spentHeight: 0,
                })),
              })),
            });
          } else {
            res.send();
          }
        });
    } else {
      getTransactions(
        {},
        {},
        (err, txs) => {
          if (err) {
            res.status(501).send();
          }
          res.json({
            pagesTotal: 1,
            txs: txs.map(tx => ({
              txid: tx.hash,
              version: tx.version,
              locktime: tx.locktime,
              vin: tx.inputs.map(input => ({
                coinbase: input.script,
                sequence: input.sequence,
                n: 0,
              })),
              vout: tx.outputs.map(output => ({
                value: output.value,
                n: 0,
                scriptPubKey: {
                  hex: '',
                  asm: '',
                  addresses: [output.address],
                  type: output.type,
                },
                spentTxid: '',
                spentIndex: 0,
                spentHeight: 0,
              })),
            })),
          });
        },
      );
    }
  });

  router.get('/rawtx/:txid', (req, res) => {
    res.send(req.params.txid);
  });

  router.post('/tx/send', (req, res) => {
    res.send('tx send stub');
  });
};
