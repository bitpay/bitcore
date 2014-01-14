'use strict';

/**
 * Module dependencies.
 */

var Address = require('../models/Address');


/**
 * Find block by hash ...
 */
exports.address = function(req, res, next, addr) {
  var a = Address.new(addr);

  a.update(function(err) {
    if (err && !a.totalReceivedSat) {
      console.log(err);
      res.status(404).send('Invalid address');
      return next();
    }

    req.address = a;
    return next();
  });
};


/**
 * Show block
 */
exports.show = function(req, res) {
  if (req.address) {

console.log(req.address);
console.log(req.address.totalSent);
console.log(JSON.stringify(req.address));
    res.jsonp(req.address);
  }
};

