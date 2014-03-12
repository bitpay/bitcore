'use strict';

var backup = console.log;
var nop = function() {};
var mute = function() {
  console.log = nop;
};

var unmute = function() {
  console.log = backup;
};

module.exports.mute = mute;
module.exports.unmute = unmute;
