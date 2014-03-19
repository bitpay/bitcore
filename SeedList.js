'use strict';
var imports      = require('soop').imports();
var parent       = imports.parent || require('events').EventEmitter;
var EventEmitter = require('events').EventEmitter;
var dns          = require('dns');

function SeedList(options) {
  SeedList.super(this, arguments);
  this.options = options || {};
  this.sources = [
    'dnsseed.bluematt.me',
    'dnsseed.bitcoin.dashjr.org',
    'seed.bitcoin.sipa.be',
    'seed.bitcoinstats.com',
    'bitseed.xf2.org'
  ];
  this.source  = this.options.source || this.sources[0];
  this.seeds   = [];
  this.find()
};

SeedList.parent = imports.parent || EventEmitter;

SeedList.prototype.find = function() {
  var self = this;
  dns.resolve(self.source, function(err, seeds) {
    if (err) {
      var index = self.sources.indexOf(self.source);
      if (index !== -1) {
        index++;
        if (!self.sources[index]) {
          return self.emit('seedsNotFound');
        }
        else {
          self.source = self.sources[index];
        }
        self.find();
      }
      return self.emit('error', err);
    }
    self.seeds = self.seeds.concat(seeds);
    self.emit('seedsFound', seeds);
  });
  return self;
};

module.exports = require('soop')(SeedList);
