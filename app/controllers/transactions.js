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
  Transaction.fromID(txid, function(err, tx) {
    if (err) return next(err);
    if (!tx) return next(new Error('Failed to load TX ' + txid));
    req.transaction = tx;
    next();
  });
};


/**
 * Show block 
 */
exports.show = function(req, res) {
  res.jsonp(req.transaction);
};

