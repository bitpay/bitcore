'use strict';

/**
 * Module dependencies.
 */

var mongoose = require('mongoose'),
    Block = mongoose.model('Block');

exports.render = function(req, res) {
  res.render('index');
};

/**
 * List of blocks at HomePage
 */
exports.all = function(req, res) {
  Block.find().limit(7).exec(function(err, blocks) {
    if (err) {
      res.render('error', {
        status: 500
      });
    } else {
      res.jsonp(blocks);
    }
  });
};
