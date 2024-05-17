import axios from 'axios';
import { Request, Response } from 'express';
import { Readable, Stream, Writable } from 'stream';

export class ExternalApiStream extends Readable {
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
          if (typeof data !== 'string') {
            data = JSON.stringify(data);
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
  static onStream(stream: Readable, req: Request, res: Response):
    Promise<{ success: boolean, error?: any }> {
    return new Promise<{ success: boolean, error?: any }>((resolve, reject) => {
      let closed = false;
      let isFirst = true;

      req.on('close', function () {
        closed = true;
      });

      res.type('json');
      res.on('close', function () {
        closed = true;
      });

      stream.on('error', function (err) {
        if (!closed) {
          closed = true;
          if (!isFirst) {
            res.write(',\n{"error": "An error occurred during data stream"}\n]');
            res.end();
            res.destroy();
            return resolve({ success: false, error: err });
          } else {
            return reject(err);
          }
        }
        return;
      });
      stream.on('data', function (data) {
        if (!closed) {
          if (isFirst) {
            res.write('[\n');
            isFirst = false;
          } else {
            res.write(',\n');
          }
          res.write(data);
        } else {
          stream.destroy();
        }
      });
      stream.on('end', function () {
        if (!closed) {
          if (isFirst) {
            // there was no data
            res.write('[]');
          } else {
            res.write('\n]');
            closed = true;
          }
          res.end();
          resolve({ success: true });
        }
      });
    });
  }

  static mergeStreams(streams: Stream[], destination: Writable): void {
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
  }
}