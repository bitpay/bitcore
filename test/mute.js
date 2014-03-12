'use strict';

var backup = console.log;
var ebackup = console.error;
var nop = function() {};
var mute = function() {
  console.log = nop;
  console.error = nop;
};

var unmute = function() {
  console.log = backup;
  console.error = ebackup;
};

module.exports.mute = mute;
module.exports.unmute = unmute;
