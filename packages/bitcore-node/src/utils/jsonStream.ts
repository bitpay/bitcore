import { Transform } from 'stream';

export class StringifyJsonStream extends Transform {
  constructor() {
    super({ objectMode: true });
  }
  _transform(item, _, done) {
    this.push(JSON.stringify(item) + '\n');
    done();
  }
}

export class ParseJsonStream extends Transform {
  constructor() {
    super({ objectMode: true });
  }
  _transform(data, _, done) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    done(null, data);
  }
}
