'use strict';

var _ = require('lodash');
var Uuid = require('uuid');

function Email() {
  this.version = '1.0.0';
};

Email.create = function(opts) {
  opts = opts || {};

  var x = new Email();

  var now = Date.now();
  x.createdOn = Math.floor(now / 1000);
  x.id = _.padLeft(now, 14, '0') + Uuid.v4();
  x.walletId = opts.walletId;
  x.copayerId = opts.copayerId;
  x.from = opts.from;
  x.to = opts.to;
  x.subject = opts.subject;
  x.body = opts.body;
  x.status = 'pending';
  x.attempts = 0;
  x.lastAttemptOn = null;
  return x;
};

Email.fromObj = function(obj) {
  var x = new Email();

  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.walletId = obj.walletId;
  x.copayerId = obj.copayerId;
  x.from = obj.from;
  x.to = obj.to;
  x.subject = obj.subject;
  x.body = obj.body;
  x.status = obj.status;
  x.attempts = obj.attempts;
  x.lastAttemptOn = obj.lastAttemptOn;
  return x;
};

Email.prototype._logAttempt = function(result) {
  this.attempts++;
  this.lastAttemptOn = Math.floor(Date.now() / 1000);
  this.status = result;
};

Email.prototype.setSent = function() {
  this._logAttempt('sent');
};

Email.prototype.setFail = function() {
  this._logAttempt('fail');
};


module.exports = Email;
