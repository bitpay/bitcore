requirejs.config({
  paths: {
  }
});

define('bitcore', ['Transaction'], function(Transaction) {
  var Bitcore = function() {
    this.Transaction = Transaction;
  };
  
  return Bitcore;
});
