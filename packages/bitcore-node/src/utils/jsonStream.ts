import { TransformWithEventPipe } from './streamWithEventPipe';

export class StringifyJsonStream extends TransformWithEventPipe {
  constructor() {
    super({ objectMode: true });
  }
  _transform(item, _, done) {
    this.push(JSON.stringify(item) + '\n');
    done();
  }
}

export class ParseJsonStream extends TransformWithEventPipe {
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
