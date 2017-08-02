const express = require('express');
const app = express();
const mongoose = require('mongoose');
const config = require('../../config/config.js');
const Block = require('../../models/block.js');
const BLOCK_LIMIT = 200;

mongoose.connect(config.mongodb.uri, config.mongodb.options);

// Address Routes
app.get('/block/:blockhash', (req, res) => {
  res.send(req.params.blockhash);
});

app.get('/blocks', (req, res) => {
  res.send({
    blocks: [],
    length: 0,
    pagination: {
    },
  });
});

app.get('/rawblock/:blockHash', (req, res) => {
  res.send(req.params.blockHash);
});

app.get('/block-index/:height', (req, res) => {
  res.send(req.params.height);
});


// Tx Routes
app.get('/tx/:txid', (req, res) => {
  res.send(req.params.txid);
});

app.get('/txs', (req, res) => {
  res.send('list of txs');
});

app.post('/tx/send', (req, res) => {
  res.send('tx send stub');
});


// Raw Routes
app.get('/rawtx/:txid', (req, res) => {
  res.send(req.params.txid);
});


// Address Routes
app.get('/addr/:addr', (req, res) => {
  res.send(req.params.addr);
});

app.get('/addr/:addr/utxo', (req, res) => {
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


// Address property routes
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


// Status
app.get('/status', (req, res) => {
  res.send('status');
});

app.get('/sync', (req, res) => {
  res.send('sync');
});

app.get('/peer', (req, res) => {
  res.send('peer');
});

app.get('/version', (req, res) => {
  res.send('version');
});

// Messages
app.get('/messages/verify', (req, res) => {
  res.send('messages verify');
});

app.post('/messages/verify', (req, res) => {
  res.send('post messages verify');
});

app.get('/utils/estimatefee', (req, res) => {
  res.send('estimate fees');
});


// Currency
app.get('/currency', (req, res) => {
  res.send('currency');
});


// 404 Catchall
app.use((req, res) => {
  res.status(404).send({
    status: 404,
    url: req.originalUrl,
    error: 'Not found',
  });
});

module.exports = app;
