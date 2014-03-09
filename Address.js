'use strict';
var imports = require('soop').imports();
var parent  = imports.parent || require('./util/VersionedData');

function Address() {
  Address.super(this, arguments);
}

Address.parent = parent;
parent.applyEncodingsTo(Address);

Address.prototype.validate = function() {
  this.doAsBinary(function() {
    Address.super(this, 'validate', arguments);
    if(this.data.length !== 21) throw new Error('invalid data length');
  });
};

module.exports = require('soop')(Address);
