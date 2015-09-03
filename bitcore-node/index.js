'use strict';

var BaseService = require('./service');
var inherits = require('util').inherits;
var fs = require('fs');

var InsightUI = function(options) {
  BaseService.call(this, options);
};

InsightUI.dependencies = ['insight-api'];

inherits(InsightUI, BaseService);

InsightUI.prototype.start = function(callback) {
  this.indexFile = this.filterIndexHTML(fs.readFileSync(__dirname + '/../public/index.html', {encoding: 'utf8'}));
  setImmediate(callback);
};

InsightUI.prototype.setupRoutes = function(app, express) {
  var self = this;

  app.use('/', function(req, res, next){
    if (req.headers.accept && req.headers.accept.indexOf('text/html') !== -1 &&
      req.headers["X-Requested-With"] !== 'XMLHttpRequest'
    ) {
      res.setHeader('Content-Type', 'text/html');
      res.send(self.indexFile);
    } else {
      express.static(__dirname + '/../public')(req, res, next);
    }
  });
};

InsightUI.prototype.filterIndexHTML = function(data) {
  var transformed = data
    .replace(/<base href=\"\/\"/, '<base href="/insight/"')
    .replace(/apiPrefix = '\/api'/, "apiPrefix = '/insight-api'");
  return transformed;
};

module.exports = InsightUI;