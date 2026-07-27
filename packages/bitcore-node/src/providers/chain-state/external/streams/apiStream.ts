import { Stream, Transform } from 'stream';
import axios from 'axios';
import logger from '../../../../logger';
import { ReadableWithEventPipe, TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';


export class ExternalApiStream extends ReadableWithEventPipe {
  static DEFAULT_REQUEST_TIMEOUT_MS = 30000;
  static DEFAULT_MAX_PAGES = 1000;

  url: string;
  headers: any;
  cursor: string | null;
  page: number;
  results: number;
  limit?: number;
  paging?: number;
  transform?: any;
  timeout: number;
  isDefaultCap: boolean;

  constructor(url, headers, args) {
    super({ objectMode: true });
    this.url = url;
    this.headers = headers;
    this.cursor = null; // Start without a cursor
    this.page = 0; // Start at page 0
    this.results = 0; // Result count

    this.limit = args?.limit; // Results limit across all pages
    // Total pages to retrieve. With neither an explicit paging nor limit bound, an external
    // provider that keeps returning cursors would be paginated forever — cap it.
    this.isDefaultCap = args?.paging == null && !args?.limit;
    this.paging = args?.paging ?? (args?.limit ? undefined : ExternalApiStream.DEFAULT_MAX_PAGES);
    this.transform = args?.transform; // Function to transform results data
    this.timeout = args?.timeout ?? ExternalApiStream.DEFAULT_REQUEST_TIMEOUT_MS; // Per-request timeout; a stalled provider response errors instead of hanging the stream
  }

  async _read() {
    try {
      // End stream if page limit is reached
      if (this.paging && this.page >= this.paging) {
        if (this.isDefaultCap) {
          logger.warn('External API stream hit the default page cap (%o pages) and was truncated: %o', this.paging, this.url);
        }
        this.push(null);
        return;
      }

      const urlWithCursor = this.cursor ? `${this.url}&cursor=${this.cursor}` : this.url;
      const response = await axios.get(urlWithCursor, { headers: this.headers, timeout: this.timeout });

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

  static mergeStreams(streams: Stream[], destination: Transform): Transform {
    let activeStreams = streams.length;
    // no sources means no 'end' events; end the destination now or it never settles
    if (activeStreams === 0) {
      destination.end();
      return destination;
    }

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