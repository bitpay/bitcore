requirejs.config({
  paths: {
  }
});

define(['Transaction'], function(Transaction) {
  var B = function() {
    this.Transaction = Transaction;
  };
  
  return new B();
});
