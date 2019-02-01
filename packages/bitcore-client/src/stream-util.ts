import { Transform } from 'stream';

export class ParseApiStream extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _write(data, _encoding, cb) {
    const stringData = data.toString().replace(',\n', '');
    if (stringData.includes('{') && stringData.includes('}')) {
      this.push(JSON.parse(stringData));
    }
    cb();
  }
}
