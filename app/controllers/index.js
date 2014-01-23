'use strict';

exports.render = function(req, res) {
  res.render('index');
};

exports.version = function(req, res) {
  var pjson = require('../../package.json');
  res.json({version: pjson.version});
};

