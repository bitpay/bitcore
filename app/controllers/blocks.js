'use strict';


var Block = require('../models/Block');
//, _ = require('lodash');



/**
 * Module dependencies.
 */


/**
 * Find block by hash ...
 */
exports.block = function(req, res, next, hash) {
  Block.fromHash(hash, function(err, block) {
    if (err) return next(err);
    if (!block) return next(new Error('Failed to load block ' + hash));
    req.block = block;
    next();
  });
};


/**
 * Show block 
 */
exports.show = function(req, res) {
  res.jsonp(req.block);
};

