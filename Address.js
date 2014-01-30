function sAddress(b) {
  var superclass = b.superclass || require('./util/VersionedData').class();

  function Address() {
    Address.super(this, arguments);
  };

  Address.superclass = superclass;
  superclass.applyEncodingsTo(Address);

  Address.prototype.validate = function() {
    this.doAsBinary(function() {
      Address.super(this, 'validate', arguments);
      if(this.data.length != 21) throw new Error('invalid data length');
    });
  };

  return Address;
};


if(!(typeof module === 'undefined')) {
  module.defineClass(sAddress);
} else if(!(typeof define === 'undefined')) {
  define(['classtool', 'util/VersionedData'],function(Classtool) {
    return Classtool.defineClass(sAddress);
  });
}

