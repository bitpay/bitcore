import { Transform, Writable } from 'stream';

/**
 * A Transform stream that forwards events to the destination stream
 */
export class TransformWithEventPipe extends Transform {
  constructor(opts = { objectMode: true }) {
    super(opts);
  }

  /**
   * Pipe that also forwards events
   * @param {TransformWithEventPipe | Transform | Writable} destination Destination stream
   * @param {Array<string>} events Events to pipe
   * @returns 
   */
  eventPipe<T extends TransformWithEventPipe | Transform | Writable>(destination: T, events?: Array<string>): T {
    this.on('error', err => destination.emit('error', err));
    for (const event of events || []) {
      this.on(event, (...args) => destination.emit(event, ...args));
    }
    return this.pipe(destination) as T;
  }
}