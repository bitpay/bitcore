const Transaction = require('../../models/transaction.js').Transaction;

const MAX_TXS = 200;

function getTransaction(params, options, cb) {
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
    Transaction.find({ txid: req.params.txid }, (err, tx) => {
      if (err) {
        res.status(501).send();
      }
      res.send(tx);
    });
  });

  router.get('/txs', (req, res) => {
    getTransaction(
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
