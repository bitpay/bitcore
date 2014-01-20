'use strict';

/**
 * Module dependencies.
 */

var Address = require('../models/Address'),
    common      = require('./common');


exports.address = function(req, res, next, addr) {


  var a;
  try {
    a = Address.new(addr);
  } catch (e) {
    return common.handleErrors({message: 'Invalid address:' + e.message, code: 1}, res, next);
  }

  a.update(function(err) {
      if (err) return common.handleErrors(err, res, next);

      req.address = a;
      return next();
    });
};


/**
 */
exports.show = function(req, res) {
  if (req.address) {
    res.jsonp(req.address);
  }
};

