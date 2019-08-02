export class ClientError {
  name: string;
  code: string;
  message: string;
  constructor(...args) {
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
    this.name = this.code;
  }

  toString() {
    return '<ClientError:' + this.code + ' ' + this.message + '>';
  }
}
