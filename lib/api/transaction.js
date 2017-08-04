const Transaction = require('../../models/transaction.js').Transaction;

module.exports = function transactionAPI(app) {
  app.get('/tx/:txid', (req, res) => {
    res.send(req.params.txid);
  });

  app.get('/txs', (req, res) => {
    res.send('list of txs');
  });

  app.get('/rawtx/:txid', (req, res) => {
    res.send(req.params.txid);
  });

  app.post('/tx/send', (req, res) => {
    res.send('tx send stub');
  });
};
