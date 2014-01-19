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
    var option = req.query.q;
    var statusObject = Status.new();

    switch(option) {
      case 'getInfo':
        statusObject.getInfo(function(err) {
          if (err) next(err);
          res.jsonp(statusObject);
        });
        break;
      case 'getDifficulty':
        statusObject.getDifficulty(function(err) {
          if (err) next(err);
          res.jsonp(statusObject);
        });
        break;
      case 'getTxOutSetInfo':
        statusObject.getTxOutSetInfo(function(err) {
          if (err) next(err);
          res.jsonp(statusObject);
        });
        break;
      case 'getBestBlockHash':
        statusObject.getBestBlockHash(function(err) {
          if (err) next(err);
          res.jsonp(statusObject);
        });
        break;
      case 'getLastBlockHash':
        statusObject.getLastBlockHash(function(err) {
          if (err) next(err);
          res.jsonp(statusObject);
        });
        break;
      default:
        res.status(400).send('Bad Request');
    }
  }
};


