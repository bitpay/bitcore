import { Readable, ReadableOptions, Transform, TransformOptions, Writable } from 'stream';

/**
 * A Transform stream that forwards events to the destination stream
 */
export class TransformWithEventPipe extends Transform {
  constructor(opts: TransformOptions & { passThrough?: boolean } = { objectMode: true }) {
    super(opts);
    if (opts.passThrough) {
      this._transform = (data, _, next) => next(null, data);
    }
  }

  /**
   * Pipe that also forwards events
   * @param {TransformWithEventPipe | Transform | Writable} destination Destination stream
   * @param {Array<string>} events Events to pipe
   * @param {any} pipeOpts Pipe options
   * @returns 
   */
  eventPipe<T extends TransformWithEventPipe | Transform | Writable>(destination: T, events?: Array<string>, pipeOpts?): T {
    this.on('error', err => destination.emit('error', err));
    for (const event of events || []) {
      this.on(event, (...args) => destination.emit(event, ...args));
    }
    return this.pipe(destination, pipeOpts) as T;
  }
}

/**
 * A Readable stream that forwards events to the destination stream
 */
export class ReadableWithEventPipe extends Readable {
  constructor(opts: ReadableOptions = { objectMode: true }) {
    super(opts);
  }

  /**
   * Pipe that also forwards events
   * @param {TransformWithEventPipe | Transform | Writable} destination Destination stream
   * @param {Array<string>} events Events to pipe
   * @param {any} pipeOpts Pipe options
   * @returns 
   */
  eventPipe<T extends TransformWithEventPipe | Transform | Writable>(destination: T, events?: Array<string>, pipeOpts?): T {
    this.on('error', err => destination.emit('error', err));
    for (const event of events || []) {
      this.on(event, (...args) => destination.emit(event, ...args));
    }
    return this.pipe(destination, pipeOpts) as T;
  }
}