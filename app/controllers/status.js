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

    var returnJsonp = function (err) {
      if(err) return next(err);
      res.jsonp(statusObject);
    };

    switch(option) {
      case 'getInfo':
        statusObject.getInfo(returnJsonp);
        break;
      case 'getDifficulty':
        statusObject.getDifficulty(returnJsonp);
        break;
      case 'getTxOutSetInfo':
        statusObject.getTxOutSetInfo(returnJsonp);
        break;
      case 'getBestBlockHash':
        statusObject.getBestBlockHash(returnJsonp);
        break;
      case 'getLastBlockHash':
        statusObject.getLastBlockHash(returnJsonp);
        break;
      default:
        res.status(400).send('Bad Request');
    }
  }
};

exports.sync = function(req, res, next) {
  if (req.syncInfo)
    res.jsonp(req.syncInfo);
  next();
};
