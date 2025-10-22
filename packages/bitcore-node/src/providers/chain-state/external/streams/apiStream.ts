import { Readable, Stream, Transform } from 'stream';
import axios from 'axios';
import { Request, Response } from 'express';
import { ReadableWithEventPipe, TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';


export interface StreamOpts {
  jsonl?: boolean;
}

export class ExternalApiStream extends ReadableWithEventPipe {
  url: string;
  headers: any;
  cursor: string | null;
  page: number;
  results: number;
  limit?: number;
  paging?: number;
  transform?: any;

  constructor(url, headers, args) {
    super({ objectMode: true });
    this.url = url;
    this.headers = headers;
    this.cursor = null; // Start without a cursor
    this.page = 0; // Start at page 0
    this.results = 0; // Result count

    this.limit = args?.limit; // Results limit across all pages
    this.paging = args?.paging; // Total pages to retrieve
    this.transform = args?.transform; // Function to transform results data
  }

  async _read() {
    try {
      // End stream if page limit is reached
      if (this.paging && this.page >= this.paging) {
        this.push(null);
      }

      const urlWithCursor = this.cursor ? `${this.url}&cursor=${this.cursor}` : this.url;
      const response = await axios.get(urlWithCursor, { headers: this.headers });

      if (response?.data?.result?.length > 0) {
        for (const result of response.data.result) {
          // End stream if result limit is reached 
          if (this.limit && this.results >= this.limit) {
            this.push(null);
            return;
          }
          let data = result;
          // Transform data before pushing
          if (this.transform) {
            data = this.transform(data);
          }
          this.push(data);
          this.results++;
        }
        // Update the cursor with the new value from the response
        this.cursor = response.data.cursor;
        // If there is no new cursor, push null to end the stream
        if (!this.cursor) {
          this.push(null);
        }
        // Page complete, increment
        this.page++;
      } else {
        // No more data, end the stream
        this.push(null);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  // handles events emitted by the streamed response, request from client, and response to client
  static onStream(stream: Readable, req: Request, res: Response, opts: StreamOpts = {}):
    Promise<{ success: boolean, error?: any }> {
    return new Promise<{ success: boolean, error?: any }>((resolve, reject) => {
      let closed = false;
      let isFirst = true;

      req.on('close', function() {
        closed = true;
      });

      res.type('json');
      res.on('close', function() {
        closed = true;
      });

      stream.on('error', function(err: any) {
        if (!closed) {
          closed = true;
          if (err.isAxiosError) {
            err.log = {
              url: err?.config?.url,
              statusCode: err?.response?.status,
              statusMsg: err?.response?.statusText,
              data: err?.response?.data,
            };
          }
          if (err.log?.data?.message?.includes('not supported')) {
            res.write('[]');
            res.end();
            return resolve({ success: false, error: err });
          }
          if (!isFirst) {
            // Data has already been written to the stream and status 200 headers have already been sent
            // We notify and log the error instead of throwing
            const errMsg = '{"error": "An error occurred during data stream"}';
            if (opts.jsonl) {
              res.write(`${errMsg}`);
            } else {
              res.write(`,\n${errMsg}\n]`);
            }
            res.end();
            res.destroy();
            return resolve({ success: false, error: err });
          } else {
            // Rejecting here allows downstream to send status 500
            return reject(err);
          }
        }
        return;
      });
      stream.on('data', function(data) {
        if (!closed) {
          // We are assuming jsonl data appended a new line upstream
          if (!opts.jsonl) {
            if (isFirst) {
              res.write('[\n');
            } else {
              res.write(',\n');
            }
          }
          if (isFirst) {
            // All cases need isFirst set correctly for proper error handling
            isFirst = false;
          }
          if (typeof data !== 'string') {
            data = JSON.stringify(data);
          }
          res.write(data);
        } else {
          stream.destroy();
        }
      });
      stream.on('end', function() {
        if (!closed) {
          closed = true;
          if (!opts.jsonl) {
            if (isFirst) {
              // there was no data
              res.write('[]');
            } else {
              res.write('\n]');
            }
          }
          res.end();
          resolve({ success: true });
        }
      });
    });
  }

  static mergeStreams(streams: Stream[], destination: Transform): Transform {
    let activeStreams = streams.length;

    for (const stream of streams) {
      // Pipe each stream to the destination
      stream.pipe(destination, { end: false });
      stream.on('error', err => destination.emit('error', err));
      stream.on('end', () => {
        activeStreams--;
        if (activeStreams === 0) {
          // End the destination stream when all input streams are done
          destination.end();
        }
      });
    };
    return destination;
  }
}

export class ParseStream extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(data: any, _, done) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    done(null, data);
  }
}

export class MergedStream extends TransformWithEventPipe {
  constructor() {
    super({ objectMode: true });
  }

  async _transform(data: any, _, done) {
    done(null, data);
  }
}