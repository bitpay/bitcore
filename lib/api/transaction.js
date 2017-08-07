const Transaction = require('../../models/transaction.js').Transaction;
const logger = require('../logger');

const MAX_TXS = 200;

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
/*
    const txsBy = req.query.blocks ||
                  req.query.address;
*/


    getTransactions(
      {},
      {},
      (err, txs) => {
        if (err) {
          res.status(501).send();
        }
        res.send(txs);
      },
    );
  });

  router.get('/rawtx/:txid', (req, res) => {
    res.send(req.params.txid);
  });

  router.post('/tx/send', (req, res) => {
    res.send('tx send stub');
  });
};
