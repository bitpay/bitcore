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
  Block.fromHashWithInfo(hash, function(err, block) {
    if (err) return next(err);
    if (!block) return next(new Error('Failed to load block ' + hash));
    req.block = block.info;
    next();
  });
};


/**
 * Show block
 */
exports.show = function(req, res) {
  res.jsonp(req.block);
};

/**
 * List of blocks at HomePage
 */
exports.last_blocks = function(req, res) {
  Block.find().sort({time:-1}).limit(7).exec(function(err, blocks) {
    if (err) {
      res.render('error', {
        status: 500
      });
    } else {
      res.jsonp(blocks);
    }
  });
};

/**
 * List of blocks by date
 */
exports.list = function(req, res) {
  var findParam = {};

  if (req.query.blockDate) {
    var gte = Math.round((new Date(req.query.blockDate)).getTime() / 1000);
    var lte = gte + 86400;

    findParam = { time: {
      '$gte': gte,
      '$lte': lte
    }};
  }

  Block
    .find(findParam)
    .limit(5)
    .exec(function(err, blocks) {
      if (err) {
        res.render('error', {
          status: 500
        });
      } else {
        res.jsonp(blocks);
      }
    });
};


1296688602



1296615600

1296615600000


