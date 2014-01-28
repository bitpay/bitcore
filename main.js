requirejs.config({
  paths: {
    'base58-native': 'browser/base58-browser',
  }
});

define(function(require) {
  var Address = require('./Address').class();
  var B = function() {
    //this.Transaction = Transaction;
    this.Address = Address;
  };
  
  return new B();
});
