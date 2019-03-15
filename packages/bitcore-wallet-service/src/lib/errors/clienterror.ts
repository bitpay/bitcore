'use strict';

function ClientError() {
  var args = Array.prototype.slice.call(arguments);

  switch (args.length) {
    case 0:
      this.code = 'BADREQUEST';
      this.message = 'Bad request';
      break;
    case 1:
      this.code = 'BADREQUEST';
      this.message = args[0];
      break;
    default:
    case 2:
      this.code = args[0];
      this.message = args[1];
      break;
  }
};

ClientError.prototype.toString = function() {
  return '<ClientError:' + this.code + ' ' + this.message + '>';
};

module.exports = ClientError;
