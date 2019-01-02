var _ = require('lodash');
var Uuid = require('uuid');

var Defaults = require('../common/defaults');

function Session() {};

Session.create = function(opts) {
  opts = opts || {};

  var now = Math.floor(Date.now() / 1000);

  var x = new Session();

  x.id = Uuid.v4();
  x.version = 1;
  x.createdOn = now;
  x.updatedOn = now;
  x.copayerId = opts.copayerId;
  x.walletId = opts.walletId;

  return x;
};

Session.fromObj = function(obj) {
  var x = new Session();

  x.id = obj.id;
  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.updatedOn = obj.updatedOn;
  x.copayerId = obj.copayerId;
  x.walletId = obj.walletId;

  return x;
};

Session.prototype.toObject = function() {
  return this;
};

Session.prototype.isValid = function() {
  var now = Math.floor(Date.now() / 1000);
  return (now - this.updatedOn) <= Defaults.SESSION_EXPIRATION;
};

Session.prototype.touch = function() {
  var now = Math.floor(Date.now() / 1000);
  this.updatedOn = now;
};

module.exports = Session;
