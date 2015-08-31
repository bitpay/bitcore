'use strict';

function ClientError(code, message) {
  this.code = code;
  this.message = message;
};

ClientError.prototype.toString = function() {
  return '<ClientError:' + this.code + ' ' + this.message + '>';
};

module.exports = ClientError;
