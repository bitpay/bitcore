'use strict';

/**
 * Module dependencies.
 */

var mongoose = require('mongoose'),
    Block = mongoose.model('Block');
//, _ = require('lodash');


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

