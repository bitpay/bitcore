'use strict';

var _ = require('lodash');

// Load app configuration
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
module.exports = _.extend(
  require(__dirname + '/../config/env/all.js'),
  require(__dirname + '/../config/env/' + process.env.NODE_ENV + '.js') || {});
