module.exports = function addressAPI(app) {
  app.get('/addr/:addr', (req, res) => {
    res.send(req.params.addr);
  });

  app.get('/addr/:addr/utxo', (req, res) => {
    res.send(req.params.addr);
  });

  app.get('/addr/:addr/balance', (req, res) => {
    res.send(req.params.addr);
  });

  app.get('/addr/:addr/totalReceived', (req, res) => {
    res.send(req.params.addr);
  });

  app.get('/addr/:addr/totalSent', (req, res) => {
    res.send(req.params.addr);
  });

  app.get('/addr/:addr/unconfirmedBalance', (req, res) => {
    res.send(req.params.addr);
  });

  app.get('/addrs/:addrs/utxo', (req, res) => {
    res.send(req.params.addrs);
  });

  app.post('/addrs/utxo', (req, res) => {
    res.send('post stub');
  });

  app.get('/addrs/:addrs/txs', (req, res) => {
    res.send(req.params.addrs);
  });

  app.post('/addrs/txs', (req, res) => {
    res.send('post stub');
  });
};
