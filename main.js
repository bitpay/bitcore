'use strict';
requirejs.config({
  paths: {
  }
});

define(function(require) {
  //var Address = require('./Address').class();
  //var Transaction = require('./Transaction').class();
  var B = function() {
    //this.Transaction = Transaction;
    //this.Address = Address;
    require('util/util');
  };
  
  return new B();
});
