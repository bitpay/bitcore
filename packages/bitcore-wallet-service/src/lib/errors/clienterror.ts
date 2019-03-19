'use strict';

export class ClientError extends Error {
  code: string;
  message: string;
  constructor(...args) {
    super()
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
  }

  toString() {
    return '<ClientError:' + this.code + ' ' + this.message + '>';
  }
}
