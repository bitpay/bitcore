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
