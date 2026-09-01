import { Readable } from 'stream';
import { Request, Response } from 'express';
import logger from '../logger';
import { AdapterError, AdapterErrorCode, AllProvidersUnavailableError } from '../providers/chain-state/external/adapters/errors';
import { jsonStringify } from '../utils';

export function respondWithError(res: Response, err: any) {
  if (err instanceof AllProvidersUnavailableError) {
    return res.status(503).json({ error: 'All indexed API providers unavailable', message: err.message });
  }
  if (err instanceof AdapterError && err.code === AdapterErrorCode.INVALID_REQUEST) {
    return res.status(400).json({ error: 'Invalid request', message: err.message });
  }
  return res.status(500).send(err.message || err);
}

export interface StreamJsonArrayOpts {
  jsonl?: boolean;
}

/**
 * Why a stream stopped short of a clean end.
 *
 * - `client-disconnect` the response closed before it finished (client hung up)
 * - `not-supported`     upstream reported the query is unsupported before any data; `[]` was sent
 * - `stream-error`      stream errored mid-body; an inline error marker was appended
 * - `closed-before-end` stream emitted 'close' without 'end'/'error'; the body was finalized
 */
export type StreamJsonArrayFailureReason =
  | 'client-disconnect'
  | 'not-supported'
  | 'stream-error'
  | 'closed-before-end';

export type StreamJsonArrayResult =
  | { success: true }
  | { success: false; reason: StreamJsonArrayFailureReason; error?: any };

// One log message per reason, kept out of the result shape so they can't drift per call site.
const FAILURE_MESSAGES: Record<StreamJsonArrayFailureReason, string> = {
  'client-disconnect': 'Client disconnected mid-stream',
  'not-supported': 'Upstream reported the query is not supported',
  'stream-error': 'Error mid-stream',
  'closed-before-end': 'Stream closed before end',
};

/**
 * Log a non-success streamJsonArray() result. Disconnects log at info: a single hangup is
 * normal traffic, but a stalled upstream shows up as every client timing out, so the
 * pattern needs to stay visible in production logs without tripping error alerting.
 *
 * @param result the result returned by streamJsonArray
 * @param context the stream entry point, e.g. 'streamAddressTransactions'
 */
export function logStreamFailure(result: StreamJsonArrayResult, context: string) {
  if (result.success) {
    return;
  }
  const detail = result.error?.log || result.error;
  const message = `${FAILURE_MESSAGES[result.reason]} (${context}): %o`;
  if (result.reason === 'client-disconnect') {
    logger.info(message, detail);
  } else {
    logger.error(message, detail);
  }
}

/**
 * Pipe a Readable stream to an Express response as a JSON array (default) or JSONL.
 *
 * - Pre-data errors reject so the route can send a proper status code
 * - Mid-stream errors append an inline error marker and end the response
 * - A response that closes without finishing is a client abort; it tears down the source
 *   (close() for cursor streams, destroy() otherwise) and settles as client-disconnect
 */
export function streamJsonArray(
  stream: Readable & { close?: () => void | Promise<void>; jsonl?: boolean },
  // unused: req 'close' only signals the body was consumed; abort detection lives on res
  _req: Request,
  res: Response,
  opts: StreamJsonArrayOpts = {}
): Promise<StreamJsonArrayResult> {
  // Auto-detect jsonl flag attached to the stream so routes stay chain-agnostic.
  const jsonl = opts.jsonl ?? stream.jsonl ?? false;
  // a dead stream already emitted its events; reject so the route can 5xx
  if (stream.destroyed) {
    return Promise.reject(new Error('stream destroyed before piping began'));
  }
  return new Promise<StreamJsonArrayResult>((resolve, reject) => {
    let closed = false;
    let isFirst = true;
    let settled = false;

    // Single-shot guards keep the promise from being resolved/rejected twice when
    // a client disconnect races a stream end/error or a stream 'close' event follows destroy().
    const safeResolve = (result: StreamJsonArrayResult) => { if (!settled) { settled = true; resolve(result); } };
    const safeReject = (err: any) => { if (!settled) { settled = true; reject(err); } };
    const fail = (reason: StreamJsonArrayFailureReason, error?: any) =>
      safeResolve({ success: false, reason, error });

    let toreDown = false;
    const tearDown = () => {
      // once only, and close() or destroy(), never both: cursor destroy() delegates to
      // close() without setting the destroyed flag, so both would double-close
      if (toreDown) return;
      toreDown = true;
      if (typeof stream.close === 'function') {
        // close() may return a promise; keep it observed
        try {
          Promise.resolve(stream.close()).catch(err => logger.warn('Failed to close stream: %o', err));
        } catch (err) {
          logger.warn('Failed to close stream: %o', err);
        }
      } else if (typeof stream.destroy === 'function' && !stream.destroyed) {
        try { stream.destroy(); } catch { /* noop */ }
      }
    };
    const cleanup = () => {
      closed = true;
      tearDown();
    };
    const onAbort = () => {
      closed = true;
      tearDown();
      // settle so the route doesn't hang on a stream that may never emit 'close'
      fail('client-disconnect', new Error('client disconnected'));
    };

    // ndjson in jsonl mode so JSON-aware clients (supertest, fetch().json()) don't try to
    // parse a stream of newline-delimited objects as a single JSON document.
    res.type(jsonl ? 'application/x-ndjson' : 'json');
    // req 'close' only means the body was consumed, and res 'close' also fires after a
    // normal finish; a response closed without finishing is the only real abort signal
    res.on('close', () => {
      if (res.writableFinished) return;
      onAbort();
    });
    // unlistened res 'error' (e.g. EPIPE) would throw; treat as an abort
    res.on('error', onAbort);

    // Named so the 'data' handler can route serialization failures through the same path
    // instead of throwing out of an event handler (which becomes an uncaughtException).
    const onStreamError = (err: any) => {
      // closed means the promise already settled; nothing left to do
      if (closed) { return; }
      if (err?.isAxiosError) {
        err.log = {
          url: err?.config?.url,
          statusCode: err?.response?.status,
          statusMsg: err?.response?.statusText,
          data: err?.response?.data,
        };
      }
      // '[]' is only valid before any rows; after data, fall through so the array gets closed
      if (isFirst && err?.log?.data?.message?.includes('not supported')) {
        closed = true;
        res.write('[]');
        res.end();
        tearDown();
        return fail('not-supported', err);
      }
      if (!isFirst) {
        // Headers already sent — emit inline error marker, end response, log upstream
        closed = true;
        const errMsg = '{"error": "An error occurred during data stream"}';
        if (jsonl) {
          res.write(`${errMsg}`);
        } else {
          res.write(`,\n${errMsg}\n]`);
        }
        res.end();
        cleanup();
        return fail('stream-error', err);
      }
      // Pre-data: caller can send a proper 5xx. Mark closed first so a still-live stream
      // (e.g. after a serialization failure) can't emit 'end' and write '[]' into a body
      // the route is about to replace with an error.
      cleanup();
      return safeReject(err);
    };
    stream.on('error', onStreamError);

    stream.on('data', (data: any) => {
      if (closed) {
        cleanup();
        return;
      }
      // Serialize before writing anything. A stringify failure must not leave a dangling
      // '[\n' or ',\n' in the body, and throwing from here would unwind through the stream
      // internals to uncaughtException rather than the route's catch block.
      let payload = data;
      if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
        try {
          payload = jsonStringify(data);
        } catch (err) {
          return onStreamError(err);
        }
      }
      if (!jsonl) {
        res.write(isFirst ? '[\n' : ',\n');
      }
      isFirst = false;
      // honor backpressure so a slow client throttles the source instead of buffering the
      // whole result set in the response
      if (!res.write(payload) && !closed) {
        stream.pause();
        res.once('drain', () => { if (!closed) stream.resume(); });
      }
    });

    stream.on('end', () => {
      if (closed) return;
      closed = true;
      if (!jsonl) {
        if (isFirst) {
          res.write('[]');
        } else {
          res.write('\n]');
        }
      }
      res.end();
      safeResolve({ success: true });
    });

    // backstop: 'close' without a prior 'end'/'error' still finalizes the response and settles
    stream.on('close', () => {
      if (closed) return;
      closed = true;
      if (isFirst) {
        // nothing written yet; let the route 5xx
        return safeReject(new Error('stream closed before end'));
      }
      const errMsg = '{"error": "An error occurred during data stream"}';
      res.write(jsonl ? errMsg : `,\n${errMsg}\n]`);
      res.end();
      fail('closed-before-end', new Error('stream closed before end'));
    });
  });
}
