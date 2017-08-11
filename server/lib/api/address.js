const Block = require('../../models/block.js');
const logger = require('../logger');

const MAX_BLOCKS = 200;

module.exports = function AddressAPI(router) {
  router.get('/addr/:addr', (req, res) => {
    res.send(req.params.addr);
  });

  router.get('/addr/:addr/utxo', (req, res) => {
    res.send(req.params.addr);
  });

  router.get('/addr/:addr/balance', (req, res) => {
    res.send(req.params.addr);
  });

  router.get('/addr/:addr/totalReceived', (req, res) => {
    res.send(req.params.addr);
  });

  router.get('/addr/:addr/totalSent', (req, res) => {
    res.send(req.params.addr);
  });

  router.get('/addr/:addr/unconfirmedBalance', (req, res) => {
    res.send(req.params.addr);
  });

  router.get('/addrs/:addrs/utxo', (req, res) => {
    res.send(req.params.addrs);
  });

  router.post('/addrs/utxo', (req, res) => {
    res.send('post stub');
  });

  router.get('/addrs/:addrs/txs', (req, res) => {
    res.send(req.params.addrs);
  });

  router.post('/addrs/txs', (req, res) => {
    res.send('post stub');
  });
};
