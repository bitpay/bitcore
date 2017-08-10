'use strict';

var BaseService = require('./service');
var inherits = require('util').inherits;
var fs = require('fs');
var pkg = require('../package');

var InsightUI = function(options) {
  BaseService.call(this, options);
  // we don't use the options object for routePrefix and apiPrefix, since the
  // client must be rebuilt with the proper options. A future version of 
  // Bitcore should allow for a service "build" step to make this better.
  this.apiPrefix = pkg.insightConfig.apiPrefix;
  this.routePrefix = pkg.insightConfig.routePrefix;
};

InsightUI.dependencies = ['insight-api'];

inherits(InsightUI, BaseService);

InsightUI.prototype.start = function(callback) {
  this.indexFile = this.filterIndexHTML(fs.readFileSync(__dirname + '/../public/index-template.html', {encoding: 'utf8'}));
  setImmediate(callback);
};

InsightUI.prototype.getRoutePrefix = function() {
  return this.routePrefix;
};

InsightUI.prototype.setupRoutes = function(app, express) {
  var self = this;
  app.use(express.static(__dirname + '/../public'));
  // if not in found, fall back to indexFile (404 is handled client-side)
  app.use(function(req, res, next) {
    res.setHeader('Content-Type', 'text/html');
    res.send(self.indexFile);
  });
};

InsightUI.prototype.filterIndexHTML = function(data) {
  var transformed = data;
  if (this.routePrefix !== '') {
    transformed = transformed.replace('<base href="/"', '<base href="/' + this.routePrefix + '/"');
  }
  return transformed;
};

module.exports = InsightUI;
