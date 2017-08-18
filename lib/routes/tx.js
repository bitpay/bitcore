'use strict';
var router = require('express').Router();

var config = require('../config');
var Transaction = require('../models/transaction');
var Storage = require('../services/storage');

const limit = 200;

router.get('/', function(req, res) {
  var query = {};
  if(req.query.blockHeight) {
    query.blockHeight = req.query.blockHeight;
  }
  if(req.query.blockHash) {
    query.blockHash = req.query.blockHash;
  }
  query.network = req.query.network || config.network;

  Storage.apiStreamingFind(Transaction, query, limit, req.query, res);
});

router.get('/:txid', function(req, res) {
  var query = {txid: req.params.txid};

  Transaction.findOne(query).exec(function(err,tx){
    if(err){
      return res.status(500).send(err);
    }
    if(!tx) {
      return res.status(404).send(new Error('tx not found'));
    }

    res.json(Transaction._apiTransform(tx, {object: true}));
  });
});
module.exports = {
  router: router,
  path: '/tx'
};