'use strict';

function PushNotificationSub() {};

PushNotificationSub.create = function(opts) {
  opts = opts || {};

  var x = new PushNotificationSub();

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);
  x.copayerId = opts.copayerId;
  x.token = opts.token;
  x.packageName = opts.packageName;
  x.platform = opts.platform;
  return x;
};

PushNotificationSub.fromObj = function(obj) {
  var x = new PushNotificationSub();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.copayerId = obj.copayerId;
  x.token = obj.token;
  x.packageName = obj.packageName;
  x.platform = obj.platform;
  return x;
};


module.exports = PushNotificationSub;
