import { Readable, Stream, Transform } from 'stream';
import { Request, Response } from 'express';
import { ExternalApiStream } from './apiStream';

export class NodeQueryStream extends Readable {
  queries: any[];
  handler: (any) => any;
  transform?: (any) => any;

  constructor(queries, handler, args) {
    super({ objectMode: true });
    this.queries = queries;
    this.handler = handler;
    this.transform = args?.transform; // Function to transform results data
  }

  async _read() {
    try {
      if (this.queries.length === 0) {
        this.push(null); // No more data, end the stream
        return;
      }
      // Retrieve and remove the first query from the list
      const query = this.queries.shift();
      // Get node response
      let data = await this.handler(query);
      // Transform data before pushing
      if (this.transform) {
        data = this.transform(data);
      }
      if (typeof data !== 'string') {
        data = JSON.stringify(data);
      }
      this.push(data); // Push the result of the handler into the stream
    } catch (error) {
      this.emit('error', error); // Emit error event in case of failure
    }
  }

  static onStream(stream: Readable, req: Request, res: Response):
  Promise<{ success: boolean; error?: any }> {
    return ExternalApiStream.onStream(stream, req, res);
  }

  static mergeStreams(streams: Stream[], destination: Transform): Transform {
    return ExternalApiStream.mergeStreams(streams, destination);
  }
}