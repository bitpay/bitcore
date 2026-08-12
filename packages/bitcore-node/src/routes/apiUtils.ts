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
 * - `client-disconnect` req or res closed before the stream finished
 * - `not-supported`     upstream reported the query is unsupported before any data; `[]` was sent
 * - `stream-error`      stream errored mid-body; an inline error marker was appended
 * - `closed-before-end` stream emitted 'close' without ever emitting 'end' or 'error'
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
 * - Client/response disconnects destroy the stream (and call .close() if present, e.g. mongo cursor)
 */
export function streamJsonArray(
  stream: Readable & { close?: () => void; jsonl?: boolean },
  req: Request,
  res: Response,
  opts: StreamJsonArrayOpts = {}
): Promise<StreamJsonArrayResult> {
  // Auto-detect jsonl flag attached to the stream so routes stay chain-agnostic.
  const jsonl = opts.jsonl ?? stream.jsonl ?? false;
  // A stream that died before this call already emitted 'error'/'close', so we'd never
  // hear it. Reject now so the route sends a 5xx instead of hanging.
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

    const tearDown = () => {
      // close() handles mongo cursor streams; destroy() tears down piped Transform chains
      // so cursor-cleanup listeners hooked to the Transform's 'close' event fire eagerly on disconnect.
      if (typeof stream.close === 'function') {
        try { stream.close(); } catch { /* noop */ }
      }
      if (typeof stream.destroy === 'function' && !stream.destroyed) {
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
      // Settle the awaiting route handler so it can fall through to its catch/finally
      // instead of hanging until the stream eventually emits 'close' (which may not happen
      // on a destroyed pipeline if upstream never settles).
      fail('client-disconnect', new Error('client disconnected'));
    };

    req.on('close', onAbort);
    // ndjson in jsonl mode so JSON-aware clients (supertest, fetch().json()) don't try to
    // parse a stream of newline-delimited objects as a single JSON document.
    res.type(jsonl ? 'application/x-ndjson' : 'json');
    res.on('close', onAbort);

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
      // '[]' is only a valid body if no rows went out yet. After data, fall through to
      // the mid-stream path so the array gets closed properly.
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
      res.write(payload);
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

    // Backstop: if destroy() emits 'close' without a prior 'end' or 'error', settle the promise
    // so the route handler doesn't await indefinitely on a torn-down pipeline. When `closed`
    // is set the promise was already settled in the same frame, so there is nothing to do.
    stream.on('close', () => {
      if (closed) return;
      fail('closed-before-end', new Error('stream closed before end'));
    });
  });
}
