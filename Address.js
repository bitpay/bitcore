var superclass = require('./util/VersionedData');
var EncodedData = require('./util/EncodedData');

function Address() {
  superclass.apply(this, arguments);
}
Address.prototype = new superclass();
EncodedData.applyEncodingsTo(Address);

Address.prototype.validate = function() {
  this.doAsBinary(function() {
    (new EncodedData()).validate.apply(this, arguments);
    if(this.data.length !== 21) throw new Error('invalid data length');
  });
};

module.exports = Address;
