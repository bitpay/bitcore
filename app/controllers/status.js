'use strict';

/**
 * Module dependencies.
 */

var Status  = require('../models/Status'),
    common      = require('./common');

/**
 *  Status
 */
exports.show = function(req, res) {
  
  if (! req.query.q) {
    res.status(400).send('Bad Request');
  }
  else {
    var option = req.query.q;
    var statusObject = Status.new();

    var returnJsonp = function (err) {
      if (err || ! statusObject)
        return common.handleErrors(err, res);
      else {
        res.jsonp(statusObject);
      }
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
      case 'getLastBlockHash':
        statusObject.getLastBlockHash(returnJsonp);
        break;
      default:
        res.status(400).send('Bad Request');
    }
  }
};

exports.sync = function(req, res) {
  if (req.historicSync)
    res.jsonp(req.historicSync.info());
};
