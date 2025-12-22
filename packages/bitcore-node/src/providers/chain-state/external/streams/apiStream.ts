/**
 * External API Stream Utilities
 *
 * NOTE! STREAM-BASED ARCHITECTURE - CRITICAL INFRASTRUCTURE:
 * This file implements the stream-based pattern for consuming paginated external APIs.
 * Understanding these classes is essential for the hybrid provider migration.
 *
 * WHY STREAMS OVER LOADING ALL DATA?
 * - Memory efficiency: Process millions of transactions without loading all into memory
 * - Backpressure handling: Automatically pause API requests when client connection is slow
 * - Progressive rendering: User sees data immediately instead of waiting for full response
 * - Error handling: Can handle errors mid-stream without losing all data
 *
 * KEY CLASSES:
 * 1. ExternalApiStream: Readable stream that fetches paginated data from external APIs
 * 2. ExternalApiStream.onStream(): Pipes stream to HTTP response with proper error handling
 * 3. ExternalApiStream.mergeStreams(): Combines multiple streams (local + remote for hybrid)
 * 4. MergedStream: Transform stream for combining data from multiple sources
 *
 * DATA FLOW:
 * User Request → Route Handler → Provider creates ExternalApiStream → onStream pipes to response
 *     └─ Stream reads data in chunks (pagination handled automatically)
 *     └─ Each chunk is transformed (provider format → internal format)
 *     └─ Client receives data progressively (JSONL or JSON array)
 *
 * TODO! FOR HYBRID PROVIDERS:
 * Use mergeStreams() to combine local MongoDB stream with external API stream:
 * ```
 * const localStream = createLocalStream(retentionWindow); // Recent data from MongoDB
 * const externalStream = new ExternalApiStream(url, headers, args); // Old data from Moralis
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
 * NOTE! EXTERNALAPISTREAM CLASS - AUTOMATIC PAGINATION HANDLER:
 * This class handles fetching paginated data from external APIs (Moralis, BlockCypher, etc.).
 * It implements the Node.js Readable Stream interface with automatic pagination.
 *
 * HOW AUTOMATIC PAGINATION WORKS:
 * 1. Constructor takes: URL, headers, args (limit, paging, transform function)
 * 2. Node.js calls _read() automatically when client is ready for more data (backpressure!)
 * 3. _read() fetches one page from the API
 * 4. Transforms each item using the provided transform function
 * 5. Pushes items to stream buffer
 * 6. Updates cursor for next page (cursor-based pagination)
 * 7. When cursor is null/undefined, pushes null to signal stream end
 *
 * PAGINATION PATTERN (CURSOR-BASED):
 * - Request 1: GET /address/0xABC... (no cursor)
 * - Response 1: { result: [...], cursor: "page2token" }
 * - Request 2: GET /address/0xABC...?cursor=page2token
 * - Response 2: { result: [...], cursor: "page3token" }
 * - Request N: GET /address/0xABC...?cursor=pageNtoken
 * - Response N: { result: [...], cursor: null } ← End of data
 *
 * THE TRANSFORM FUNCTION:
 * - Converts provider-specific format to our internal format on-the-fly
 * - Example: Moralis transaction format → EVMTransactionJSON format
 * - Runs for EACH item as it's streamed (not all at once)
 * - See MoralisStateProvider._streamAddressTransactionsFromMoralis() for usage
 *
 * TODO! FOR OTHER PROVIDERS (UTXO CHAINS):
 * - BlockCypher uses offset-based pagination (page=1, page=2, etc. instead of cursors)
 * - May need BlockCypherApiStream class that extends this and overrides _read()
 * - Or add pagination strategy parameter to handle both cursor and offset styles
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
      // NOTE! Check page limit (if paging parameter was set)
      if (this.paging && this.page >= this.paging) {
        this.push(null); // Signal end of stream
      }

      // NOTE! Build URL with cursor for pagination
      const urlWithCursor = this.cursor
        ? `${this.url}&cursor=${this.cursor}` // Append cursor for subsequent pages
        : this.url; // First request has no cursor

      // NOTE! Fetch one page from external API
      const response = await axios.get(urlWithCursor, { headers: this.headers });

      if (response?.data?.result?.length > 0) {
        // NOTE! Process each item in this page
        for (const result of response.data.result) {
          // NOTE! Check result limit (total items across all pages)
          if (this.limit && this.results >= this.limit) {
            this.push(null); // Hit limit, end stream
            return;
          }
          let data = result;
          // NOTE! Transform provider format to internal format (if transform function provided)
          if (this.transform) {
            data = this.transform(data); // e.g., Moralis TX → EVMTransactionJSON
          }
          this.push(data); // Push to stream buffer (sent to client)
          this.results++; // Track total results
        }
        // NOTE! Update cursor for next page
        this.cursor = response.data.cursor; // Moralis provides cursor in response
        // NOTE! Check if we've reached the end (no more pages)
        if (!this.cursor) {
          this.push(null); // No cursor = last page, end stream
        }
        // NOTE! Increment page counter
        this.page++;
      } else {
        // NOTE! No results in response, end stream
        this.push(null);
      }
    } catch (error) {
      // NOTE! Emit error event (caught by onStream error handler)
      this.emit('error', error);
    }
  }

  /**
   * NOTE! ONSTREAM METHOD - PIPES STREAM TO HTTP RESPONSE:
   * This static method pipes a stream to an HTTP response with proper error handling.
   * It's the final step in the request → stream → response pipeline.
   *
   * WHAT IT DOES:
   * 1. Sets up listeners for client disconnect (req.close, res.close)
   * 2. Handles stream errors gracefully (before and after first data chunk)
   * 3. Formats output as JSON array or JSONL (JSON Lines) based on opts
   * 4. Manages response lifecycle (opening bracket, items, closing bracket)
   *
   * ERROR HANDLING STATES:
   * - BEFORE first data chunk: Can send 500 status (headers not sent yet)
   * - AFTER first data chunk: Status 200 already sent, must handle inline
   *   → Appends error object to response
   *   → Logs error for monitoring
   *   → Closes stream gracefully (partial data is better than no data)
   *
   * OUTPUT FORMATS:
   * - JSON (default): Wraps in array [ item1,\n item2,\n ... ]
   *   Good for: Standard API responses, small datasets
   * - JSONL (opts.jsonl=true): One object per line
   *   Good for: Large datasets, streaming parsers, line-by-line processing
   *
   * TODO! CURRENT USAGE PATTERN (needs improvement):
   * Currently called from within provider methods (coupled to HTTP):
   *   await ExternalApiStream.onStream(stream, req, res);
   *
   * BETTER PATTERN:
   * Provider methods should RETURN streams, route handlers should call onStream:
   *   const stream = await provider.streamWalletTransactions(params);
   *   await ExternalApiStream.onStream(stream, req, res);
   *
   * This separates business logic (creating streams) from HTTP concerns (sending response).
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
          // NOTE! Handle JSON array formatting (add commas and brackets)
          if (!opts.jsonl) {
            if (isFirst) {
              res.write('[\n'); // Start of JSON array
            } else {
              res.write(',\n'); // Comma between items
            }
          }
          // NOTE! Track first data chunk (for error handling state)
          if (isFirst) {
            isFirst = false; // After first chunk, we've sent 200 status
          }
          // NOTE! Stringify objects to JSON (if not already string)
          if (typeof data !== 'string') {
            data = JSON.stringify(data);
          }
          res.write(data); // Write chunk to HTTP response
        } else {
          stream.destroy(); // Client disconnected, clean up stream
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
   * NOTE! MERGESTREAMS METHOD - HYBRID QUERY IMPLEMENTATION:
   * This static method combines multiple streams into one destination stream.
   * Essential for implementing hybrid providers that combine local + external data.
   *
   * HOW IT WORKS:
   * 1. Pipes all source streams to destination (with { end: false } so destination stays open)
   * 2. Tracks number of active streams
   * 3. When ALL source streams end, ends the destination stream
   * 4. Propagates errors from ANY stream to destination
   *
   * HYBRID PROVIDER USAGE EXAMPLE:
   * ```
   * // Stream 1: Recent data from local MongoDB (last 30 days)
   * const retentionCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
   * const localStream = EVMTransactionStorage.collection
   *   .find({ chain, network, address, blockTime: { $gte: retentionCutoff } })
   *   .stream();
   *
   * // Stream 2: Historical data from Moralis API (older than 30 days)
   * const externalStream = new ExternalApiStream(
   *   `${moralisUrl}/address/${address}`,
   *   headers,
   *   { to_date: retentionCutoff } // Only query historical data
   * );
   *
   * // Merge both streams into one
   * const merged = ExternalApiStream.mergeStreams(
   *   [localStream, externalStream],
   *   new MergedStream() // Pass-through transform that combines both
   * );
   *
   * // Pipe merged stream to HTTP response
   * await ExternalApiStream.onStream(merged, req, res);
   * ```
   *
   * TODO! IMPLEMENTATION CHALLENGES TO ADDRESS:
   * 1. ORDERING: Streams emit concurrently, results may be out of chronological order
   *    Solution: Add SortingTransform that buffers and sorts by blockHeight/timestamp
   *
   * 2. DEDUPLICATION: Data at retention boundary might overlap (same tx in both streams)
   *    Solution: Add DedupeTransform that tracks seen txids and filters duplicates
   *
   * 3. SMOOTH TRANSITION: Need to ensure no gaps at retention boundary
   *    Solution: Use inclusive cutoff (local: >= cutoff, external: <= cutoff + buffer)
   *
   * Example with transforms:
   * ```
   * const merged = ExternalApiStream.mergeStreams([localStream, externalStream], new MergedStream())
   *   .pipe(new DedupeTransform()) // Remove duplicates
   *   .pipe(new SortingTransform()); // Sort by blockHeight
   * ```
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