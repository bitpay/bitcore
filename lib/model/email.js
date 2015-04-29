'use strict';

function Email() {
  this.version = '1.0.0';
};

Email.create = function(opts) {
  opts = opts || {};

  var x = new Email();

  x.createdOn = Math.floor(Date.now() / 1000);
  x.walletId = opts.walletId;
  x.copayerId = opts.copayerId;
  x.from = opts.from;
  x.to = opts.to;
  x.subject = opts.subject;
  x.body = opts.body;
  x.status = 'pending';
  x.attempts = 0;
  x.sentOn = null;
  return x;
};

Email.fromObj = function(obj) {
  var x = new Email();

  x.createdOn = obj.createdOn;
  x.walletId = obj.walletId;
  x.copayerId = obj.copayerId;
  x.from = obj.from;
  x.to = obj.to;
  x.subject = obj.subject;
  x.body = obj.body;
  x.status = obj.status;
  x.attempts = obj.attempts;
  x.sentOn = obj.sentOn;
  return x;
};


module.exports = Email;
