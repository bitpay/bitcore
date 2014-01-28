requirejs.config({
  paths: {
  }
});

define(function(require) {
  var Address = require('./Address').class();
  //var Transaction = require('./Transaction').class();
  var B = function() {
    //this.Transaction = Transaction;
    this.Address = Address;
  };
  
  return new B();
});
