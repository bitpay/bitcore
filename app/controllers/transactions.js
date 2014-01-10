'use strict';


var Transaction = require('../models/Transaction');
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

