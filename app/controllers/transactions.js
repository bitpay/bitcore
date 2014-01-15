'use strict';


var Transaction = require('../models/Transaction');
var Block       = require('../models/Block');
var Address     = require('../models/Address');
var async       = require('async');
//, _ = require('lodash');



/**
 * Module dependencies.
 */


/**
 * Find block by hash ...
 */
exports.transaction = function(req, res, next, txid) {
  Transaction.fromIdWithInfo(txid, function(err, tx) {
    if (err) {
      console.log(err);
      res.status(404).send('Not found');
      return next();
    }

    if (!tx) return next(new Error('Failed to load TX ' + txid));
    req.transaction = tx.info;
    next();
  });
};


/**
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

exports.transactions = function(req, res, next) {
  var bId = req.query.block;
  var aId = req.query.address;

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
  else {
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
};

