'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Block = mongoose.model('Block');


/**
 * Find block by hash ...
 */
exports.block = function(req, res, next, hash) {
  Block.fromHashWithInfo(hash, function(err, block) {
    if (err && !block) {
      console.log(err);
      res.status(404).send('Not found');
      return next();
    }

    req.block = block.info;
    return next();
  });
};


/**
 * Show block
 */
exports.show = function(req, res) {
  if (req.block) {
    res.jsonp(req.block);
  }
};


/**
 * List of blocks by date
 */
exports.list = function(req, res) {
  var limit = req.query.limit || 0;

  //helper to convert timestamps to yyyy-mm-dd format
  var formatTimestamp = function (date) {
    var yyyy = date.getUTCFullYear().toString();
    var mm = (date.getUTCMonth() + 1).toString(); // getMonth() is zero-based
    var dd  = date.getUTCDate().toString();

    return yyyy + '-' + (mm[1] ? mm : '0' + mm[0]) + '-' + (dd[1] ? dd : '0' + dd[0]); //padding
  };

  var dateStr;
  if (req.query.blockDate) {
    dateStr = req.query.blockDate;
  } else {
    dateStr = formatTimestamp(new Date());
  }

  var gte = Math.round((new Date(dateStr)).getTime() / 1000);

  //pagination
  var lte = gte + 86400;
  var prev = formatTimestamp(new Date((gte - 86400) * 1000));
  var next = formatTimestamp(new Date(lte * 1000));

  Block
    .find({
      time: {
        '$gte': gte,
        '$lte': lte
      }
    })
    .limit(limit)
    .exec(function(err, blocks) {
      if (err) {
        res.status(500).send(err);
      } else {
        res.jsonp({
          blocks: blocks,
          pagination: {
            next: next,
            prev: prev,
            current: dateStr
          }
        });
      }
    });
};
