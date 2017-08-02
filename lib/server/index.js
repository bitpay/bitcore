const express = require('express');
const app = express();
const mongoose = require('mongoose');
const config = require('../../config/config.js');
const Block = require('../../models/block.js');

mongoose.connect(config.mongodb.uri, config.mongodb.options);

app.get('/block/:blockhash', (req, res) => {
  res.send(req.params.blockhash);
});

app.get('/blocks', (req, res) => {
  res.send({
    blocks: [],
    length: 0,
    pagination: {
      next:
    }
  })
});

module.exports = app;
