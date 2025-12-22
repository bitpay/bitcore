/**
 * External API Stream Utilities
 *
 * TODO! STREAM-BASED ARCHITECTURE - CRITICAL FILE:
 * This file implements the stream-based pattern for consuming paginated external APIs.
 * Understanding these classes is essential for the hybrid provider migration.
 *
 * WHY STREAMS?
 * - Memory efficiency: Process millions of transactions without loading all into memory
 * - Backpressure handling: Automatically pause API requests when client connection is slow
 * - Progressive rendering: User sees data immediately instead of waiting for full response
 * - Error handling: Can handle errors mid-stream without losing all data
 *
 * KEY CLASSES:
 * 1. ExternalApiStream: Readable stream that fetches paginated data from external APIs
 * 2. ExternalApiStream.onStream(): Pipes stream to HTTP response with proper error handling
 * 3. ExternalApiStream.mergeStreams(): Combines multiple streams (e.g., local + remote)
 * 4. MergedStream: Transform stream for combining data from multiple sources
 *
 * UNDERSTANDING THE FLOW (for junior engineers):
 * User Request → Route Handler → Provider creates ExternalApiStream → onStream pipes to response
 *     └─ Stream reads data in chunks (pagination)
 *     └─ Each chunk is transformed and written to client
 *     └─ Client receives data progressively (JSONL or JSON array)
 *
 * TODO! FOR HYBRID PROVIDERS:
 * Use mergeStreams() to combine local MongoDB stream with external API stream:
 * ```
 * const localStream = createLocalStream(retentionWindow);
 * const externalStream = new ExternalApiStream(url, headers, args);
 * const merged = ExternalApiStream.mergeStreams([localStream, externalStream], new MergedStream());
 * await ExternalApiStream.onStream(merged, req, res);
 * ```
 */

import { Readable, Stream, Transform } from 'stream';
import axios from 'axios';
import { Request, Response } from 'express';
import { ReadableWithEventPipe, TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';


export interface StreamOpts {
  jsonl?: boolean;
}

/**
 * TODO! EXTERNALAPISTREAM CLASS - PAGINATED API CONSUMER:
 * This class handles fetching paginated data from external APIs (like Moralis, BlockCypher).
 * It implements the Node.js Readable Stream interface with automatic pagination.
 *
 * HOW IT WORKS (for junior engineers):
 * 1. Constructor takes a URL, headers, and args (limit, paging, transform)
 * 2. _read() is called automatically by Node.js when client is ready for more data
 * 3. Fetches one page of data from the API
 * 4. Transforms each item (if transform function provided)
 * 5. Pushes items to stream
 * 6. Updates cursor for next page
 * 7. When no more data, pushes null to signal end
 *
 * PAGINATION PATTERN:
 * - Moralis uses cursor-based pagination: ?cursor=xyz for next page
 * - Each response includes cursor for next page
 * - When cursor is null/undefined, we've reached the end
 *
 * THE TRANSFORM FUNCTION:
 * - Converts provider-specific format to our internal format
 * - Example: Moralis transaction → EVMTransactionJSON
 * - See MoralisStateProvider._streamAddressTransactionsFromMoralis for usage
 *
 * TODO! FOR OTHER PROVIDERS:
 * - BlockCypher uses offset-based pagination (page numbers instead of cursors)
 * - May need to create BlockCypherApiStream that extends this class
 * - Override _read() to handle different pagination styles
 */
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

  /**
   * TODO! ONSTREAM METHOD - HTTP RESPONSE HANDLER:
   * This static method pipes a stream to an HTTP response with proper error handling.
   * It's the final step in the request → stream → response pipeline.
   *
   * WHAT IT DOES:
   * 1. Sets up listeners for client disconnect (req.close, res.close)
   * 2. Handles stream errors gracefully (before and after first data chunk)
   * 3. Formats output as JSON array or JSONL (JSON Lines) based on opts
   * 4. Manages response lifecycle (opening [, items, closing ])
   *
   * ERROR HANDLING STATES:
   * - BEFORE first data: Can send 500 status (no headers sent yet)
   * - AFTER first data: Status 200 already sent, must handle inline
   *   → Appends error object to response
   *   → Logs error for monitoring
   *   → Closes stream gracefully
   *
   * JSON vs JSONL:
   * - JSON (default): Wraps in array [ item1,\n item2,\n ... ]
   * - JSONL (opts.jsonl=true): One object per line (better for streaming parsers)
   *
   * TODO! STUDY WITH:
   * - BaseEVMStateProvider.streamWalletTransactions(): Uses this for response
   * - MoralisStateProvider._buildAddressTransactionsStream(): Creates stream for this
   *
   * This pattern ensures consistent error handling across all streaming endpoints.
   */
  // handles events emitted by the streamed response, request from client, and response to client
  static onStream(stream: Readable, req: Request, res: Response, opts: StreamOpts = {}):
  Promise<{ success: boolean; error?: any }> {
    return new Promise<{ success: boolean; error?: any }>((resolve, reject) => {
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

  /**
   * TODO! MERGESTREAMS METHOD - CRITICAL FOR HYBRID ARCHITECTURE:
   * This static method combines multiple streams into one destination stream.
   * Essential for implementing hybrid providers that combine local + external data.
   *
   * HOW IT WORKS:
   * 1. Pipes all source streams to destination (with { end: false })
   * 2. Tracks number of active streams
   * 3. When all streams end, ends the destination stream
   * 4. Propagates errors from any stream to destination
   *
   * HYBRID PROVIDER USAGE:
   * ```
   * // Stream 1: Recent data from local MongoDB
   * const localStream = EVMTransactionStorage.collection
   *   .find({ blockHeight: { $gte: retentionCutoff } })
   *   .stream();
   *
   * // Stream 2: Historical data from external API
   * const externalStream = new ExternalApiStream(
   *   moralisUrl,
   *   headers,
   *   { endBlock: retentionCutoff }
   * );
   *
   * // Merge both streams
   * const merged = ExternalApiStream.mergeStreams(
   *   [localStream, externalStream],
   *   new MergedStream()
   * );
   *
   * // Pipe to response
   * await ExternalApiStream.onStream(merged, req, res);
   * ```
   *
   * TODO! CONSIDERATIONS FOR IMPLEMENTATION:
   * - Order of results: Streams emit data concurrently, may be out of order
   * - Deduplication: If data overlaps between local/external, need to dedupe
   * - Sorting: May need to sort merged results by blockHeight/timestamp
   * - Use TransformStream between merge and response to handle these concerns
   */
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