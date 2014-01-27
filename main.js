requirejs.config({
  paths: {
  }
});

define(function(require) {
  var Transaction = require('./Transaction').class();
  var B = function() {
    this.Transaction = Transaction;
  };
  
  return new B();
});
