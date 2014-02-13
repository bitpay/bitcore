'use strict';

/**
 * Module dependencies.
 */
var common    = require('./common'),
    async     = require('async'),
    BlockDb   = require('../../lib/BlockDb').class();

var bdb = new BlockDb();

/**
 * Find block by hash ...
 */
exports.block = function(req, res, next, hash) {
  bdb.fromHashWithInfo(hash, function(err, block) {
    if (err || ! block)
      return common.handleErrors(err, res, next);
    else {
      req.block = block.info;
      return next();
    }
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
 * Show block by Height
 */
exports.blockindex = function(req, res, next, height) {
  bdb.blockIndex(height, function(err, hashStr) {
    if (err) {
      console.log(err);
      res.status(400).send('Bad Request'); // TODO
    }
    else {
      res.jsonp(hashStr);
    }
  });
};

var getBlock = function(blockhash, cb) {
  bdb.fromHashWithInfo(blockhash, function(err, block) {
    if (err) {
      console.log(err);
      return cb(err);
    }

    // TODO
    if (!block.info) {
console.log('[blocks.js.60]: could not get %s from RPC. Orphan? Error?', blockhash); //TODO
      // Probably orphan
      block.info = {
        hash: blockhash,
        isOrphan: 1,
      };
    }
    return cb(err, block.info);
  });
};

/**
 * List of blocks by date
 */
exports.list = function(req, res) {
  var isToday = false;

  //helper to convert timestamps to yyyy-mm-dd format
  var formatTimestamp = function (date) {
    var yyyy = date.getUTCFullYear().toString();
    var mm = (date.getUTCMonth() + 1).toString(); // getMonth() is zero-based
    var dd  = date.getUTCDate().toString();

    return yyyy + '-' + (mm[1] ? mm : '0' + mm[0]) + '-' + (dd[1] ? dd : '0' + dd[0]); //padding
  };

  var dateStr;
  var todayStr = formatTimestamp(new Date());

  if (req.query.blockDate) {
    // TODO: Validate format yyyy-mm-dd
    dateStr = req.query.blockDate;
    isToday = dateStr === todayStr;
  } else {
    dateStr = todayStr;
    isToday = true;
  }

  var gte = Math.round((new Date(dateStr)).getTime() / 1000);

  //pagination
  var lte = gte + 86400;
  var prev = formatTimestamp(new Date((gte - 86400) * 1000));
  var next = formatTimestamp(new Date(lte * 1000));

  bdb.getBlocksByDate(gte, lte, function(err, blocks) {
    if (err) {
      res.status(500).send(err);
    }
    else {
      var limit = parseInt(req.query.limit || blocks.length);
      if (blocks.length < limit) {
        limit = blocks.length;
      }
      async.mapSeries(blocks,
        function(b, cb) {
          getBlock(b.hash, function(err, info) {
            return cb(err,{
              height: info.height,
              size: info.size,
              hash: b.hash,
              time: b.ts || info.time,
              txlength: info.tx.length,
            });
          });
        }, function(err, allblocks) {
        res.jsonp({
          blocks: allblocks,
          length: allblocks.length,
          pagination: {
            next: next,
            prev: prev,
            currentTs: lte-1,
            current: dateStr,
            isToday: isToday
          }
        });
      });
    }
  });
};
