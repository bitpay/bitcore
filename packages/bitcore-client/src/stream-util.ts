import { Transform } from 'stream';

export class ParseApiStream extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _write(data, _encoding, cb) {
    const stringDatas = data.toString().split('\n');
    for (let stringData of stringDatas) {
      const normalized = stringData.endsWith(',')
        ? stringData.slice(0, stringData.length - 1)
        : stringData;
      if (normalized.includes('{') && normalized.includes('}')) {
        this.push(JSON.parse(normalized));
      }
    }
    cb();
  }
}
