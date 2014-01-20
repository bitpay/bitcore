'use strict';

/**
 * Module dependencies.
 */
var Transaction = require('../models/Transaction');
var Block       = require('../models/Block');
var Address     = require('../models/Address');
var async       = require('async');
var common      = require('./common');


/**
 * Find block by hash ...
 */
exports.transaction = function(req, res, next, txid) {
  Transaction.fromIdWithInfo(txid, function(err, tx) {
    if (err || ! tx)
      return common.handleErrors(err, res);
    else {
      req.transaction = tx.info;
      return next();
    }
  });
};


/**
 * Show transaction
 */
exports.show = function(req, res) {

  if (req.transaction) {
    res.jsonp(req.transaction);
  }
};


var getTransaction = function(txid, cb) {
  Transaction.fromIdWithInfo(txid, function(err, tx) {
    if (err) {
      console.log(err);
      return cb(err);
    }
    return cb(null, tx.info);
  });
};


/**
 * List of transaction
 */
exports.list = function(req, res, next) {
  var bId = req.query.block;
  var aId = req.query.address;
  var limit = req.query.limit || 1000;

  if (bId) {
    Block.fromHashWithInfo(bId, function(err, block) {
      if (err && !block) {
        console.log(err);
        res.status(404).send('Not found');
        return next();
      }

      async.mapSeries(block.info.tx, getTransaction,
        function(err, results) {
          res.jsonp(results);
        });
    });
  }
  else if (aId) {
    var a = Address.new(aId);

    a.update(function(err) {
      if (err && !a.totalReceivedSat) {
        console.log(err);
        res.status(404).send('Invalid address');
        return next();
      }

      async.mapSeries(a.transactions, getTransaction,
        function(err, results) {
          res.jsonp(results);
        });
    });
  }
  else {
    Transaction
      .find()
      .limit(limit)
      .sort('-time')
      .exec(function(err, txs) {
        if (err) {
          res.status(500).send(err);
        } else {
          res.jsonp(txs);
        }
      });
  }
};
