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
 * Find transaction by hash ...
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

    if (!tx || !tx.info) {
console.log('[transactions.js.48]:: TXid %s not found in RPC. CHECK THIS.', tx.txid); //TODO
      // not check this. no
      tx.info = {
        txid: tx.txid,
      };
    }

    return cb(null, tx.info);
  });
};


/**
 * List of transaction
 */
exports.list = function(req, res, next) {
  var limit = req.query.limit || 5;
  var bId = req.query.block;
  var addrStr = req.query.address;
  var page = req.query.pageNum;
  var pageLength = 20;
  var pagesTotal = 1;
  var txLength;
  var txs;

  if (bId) {
    Block.fromHashWithInfo(bId, function(err, block) {
      if (err) {
        console.log(err);
        return res.status(500).send('Internal Server Error');
      }

      if (! block) {
        return res.status(404).send('Not found');
      }

      txLength = block.info.tx.length;

      if (page) {
        var spliceInit = page * pageLength;
        txs = block.info.tx.splice(spliceInit, pageLength);
        pagesTotal = Math.ceil(txLength / pageLength);
      }
      else {
        txs = block.info.tx;
      }

      async.mapSeries(txs, getTransaction, function(err, results) {
        if (err) {
          console.log(err);
          res.status(404).send('TX not found');
        }

        res.jsonp({
          pagesTotal: pagesTotal,
          txs: results
        });
      });
    });
  }
  else if (addrStr) {
    var a = Address.new(addrStr);

    a.update(function(err) {
      if (err && !a.totalReceivedSat) {
        console.log(err);
        res.status(404).send('Invalid address');
        return next();
      }

      txLength = a.transactions.length;

      if (page) {
        var spliceInit = page * pageLength;
        txs = a.transactions.splice(spliceInit, pageLength);
        pagesTotal = Math.ceil(txLength / pageLength);
      }
      else {
        txs = a.transactions;
      }

      async.mapSeries(txs, getTransaction, function(err, results) {
        if (err) {
          console.log(err);
          res.status(404).send('TX not found');
        }

        res.jsonp({
          pagesTotal: pagesTotal,
          txs: results
        });
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
          var txids = [];
          for(var i=0;i<txs.length;i++) {
            txids.push(txs[i].txid);
          }

          async.mapSeries(txids, getTransaction, function(err, alltxs) {
            if (err) {
              console.log(err);
              res.status(404).send('TX not found');
            }

            res.jsonp({
              txs: alltxs,
              length: alltxs.length
            });
          });
        }
      });
  }

};
