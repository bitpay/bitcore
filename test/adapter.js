'use strict';

if (typeof require === 'undefined') {
  var that = this;
  that.require = function(name) {
    var split = name.split('/');
    if (split.length > 0) {
      name = split.pop();
    }
    var module = that[name];
    if (!module) {
      throw new Error('Cannot find module "'+name+'"');
    }
    return module;
  };
  
}


if (typeof module === 'undefined') {
  var that = this;
  that.module = bitcore.module;
}
