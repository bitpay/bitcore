'use strict';

/**
 * Module dependencies.
 */

var Status  = require('../models/Status');

/**
 *  Status
 */
exports.show = function(req, res, next) {

  if (! req.query.q) {
    res.status(400).send('Bad Request');
  }
  else {
    var s = req.query.q;
    var d = Status.new();
    
    if (s === 'getInfo') {
      d.getInfo(function(err) {
        if (err) next(err);
        res.jsonp(d);
      });
    }
    else if (s === 'getDifficulty') {
      d.getDifficulty(function(err) {
        if (err) next(err);
        res.jsonp(d);
      });
    }
    else if (s === 'getTxOutSetInfo') {
      d.getTxOutSetInfo(function(err) {
        if (err) next(err);
        res.jsonp(d);
      });
    }
    else if (s === 'getBestBlockHash') {
      d.getBestBlockHash(function(err) {
        if (err) next(err);
        res.jsonp(d);
      });
    }
    else if (s === 'getLastBlockHash') {
      d.getLastBlockHash(function(err) {
        if (err) next(err);
        res.jsonp(d);
      });
    }

    else {
     res.status(400).send('Bad Request');
    }
  }
};

