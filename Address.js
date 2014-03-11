'use strict';
var imports = require('soop').imports();
var parent  = imports.parent || require('./util/VersionedData');

function Address() {
  Address.super(this, arguments);
}

Address.parent = parent;
parent.applyEncodingsTo(Address);

Address.prototype.validate = function() {
  var answer;
  this.doAsBinary(function() {
    Address.super(this, 'validate', arguments);
    answer = (this.data.length === 21);
  });
  return answer;
};

module.exports = require('soop')(Address);
