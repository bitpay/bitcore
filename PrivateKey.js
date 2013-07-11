require('classtool');

function ClassSpec(b) {
  var superclass = b.superclass || require('./util/VersionedData').class();

  function PrivateKey() {
    PrivateKey.super(this, arguments);
  };

  PrivateKey.superclass = superclass;
  superclass.applyEncodingsTo(PrivateKey);

  PrivateKey.prototype.validate = function() {
    this.doAsBinary(function() {
      PrivateKey.super(this, 'validate', arguments);
      if (this.data.length < 32 || this.data.length > 33)
        throw new Error('invalid data length');
    });
  };

  return PrivateKey;
};
module.defineClass(ClassSpec);
