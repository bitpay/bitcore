const express = require('express');
const app = express();
const mongoose = require('mongoose');
const config = require('../../config/config.js');
const Block = require('../../models/block.js');

mongoose.connect(config.mongodb.uri, config.mongodb.options);

app.get('/block/:blockhash', (req, res) => {
  res.send(req.params.blockhash);
});

module.exports = app;
