requirejs.config({
  paths: {
  }
});

define(['bitcore'], function(Bitcore) {
  var B = function(url) {
    return Bitcore.new();
  };
  
  return B;
});
