'use strict';

var BaseService = require('./service');
var inherits = require('util').inherits;
var fs = require('fs');

var InsightUI = function(options) {
  BaseService.call(this, options);
  if (typeof options.apiPrefix !== 'undefined') {
    this.apiPrefix = options.apiPrefix;
  } else {
    this.apiPrefix = 'insight-api';
  }
  if (typeof options.routePrefix !== 'undefined') {
    this.routePrefix = options.routePrefix;
  } else {
    this.routePrefix = 'insight';
  }
};

InsightUI.dependencies = ['insight-api'];

inherits(InsightUI, BaseService);

InsightUI.prototype.start = function(callback) {

  var self = this;

  var indexFile = __dirname + '/../public/index.html';

  fs.readFile(indexFile, { encoding: 'utf8' }, function(err, data) {

    if(err) {
      return callback(err);
    }

    self.indexFile = self.filterIndexHTML(data);
    callback();
  });
};

InsightUI.prototype.getRoutePrefix = function() {
  return this.routePrefix;
};

InsightUI.prototype.setupRoutes = function(app, express) {
  var self = this;

  app.use('/', function(req, res, next){

    if (req.url === '/') {
      res.send(self.indexFile);
    } else {
      express.static(__dirname + '/../public')(req, res, next);
    }

  });
};

InsightUI.prototype.filterIndexHTML = function(data) {
  var transformed = data
    .replace(/apiPrefix = '\/api'/, "apiPrefix = '/" + this.apiPrefix + "'");

  if (this.routePrefix) {
    transformed = transformed.replace(/<base href=\"\/\"/, '<base href="/' + this.routePrefix + '/"');
  }

  return transformed;
};

module.exports = InsightUI;
