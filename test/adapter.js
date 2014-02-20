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
      if (!bitcore[name])
        throw new Error('Cannot find module "'+name+'"');
      return bitcore[name];
    }
    return module;
  };
  
}

this.Buffer = require('Buffer');

