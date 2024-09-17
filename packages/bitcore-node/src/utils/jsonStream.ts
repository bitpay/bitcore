import { TransformWithEventPipe } from './streamWithEventPipe';

export class StringifyJsonStream extends TransformWithEventPipe {
  constructor() {
    super({ objectMode: true });
  }
  _transform(item, _, done) {
    done(null, JSON.stringify(item) + '\n');
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
