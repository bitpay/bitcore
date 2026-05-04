import { Readable } from 'stream';
import { Request, Response } from 'express';
import { AdapterError, AdapterErrorCode, AllProvidersUnavailableError } from '../providers/chain-state/external/adapters/errors';

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

export interface StreamJsonArrayResult {
  success: boolean;
  error?: any;
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
  return new Promise<StreamJsonArrayResult>((resolve, reject) => {
    let closed = false;
    let isFirst = true;
    let settled = false;

    // Single-shot guards keep the promise from being resolved/rejected twice when
    // a client disconnect races a stream end/error or a stream 'close' event follows destroy().
    const safeResolve = (result: StreamJsonArrayResult) => { if (!settled) { settled = true; resolve(result); } };
    const safeReject = (err: any) => { if (!settled) { settled = true; reject(err); } };

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
      safeResolve({ success: false, error: new Error('client disconnected') });
    };

    req.on('close', onAbort);
    res.type('json');
    res.on('close', onAbort);

    stream.on('error', (err: any) => {
      if (closed) { safeResolve({ success: false, error: err }); return; }
      if (err?.isAxiosError) {
        err.log = {
          url: err?.config?.url,
          statusCode: err?.response?.status,
          statusMsg: err?.response?.statusText,
          data: err?.response?.data,
        };
      }
      if (err?.log?.data?.message?.includes('not supported')) {
        closed = true;
        res.write('[]');
        res.end();
        return safeResolve({ success: false, error: err });
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
        return safeResolve({ success: false, error: err });
      }
      // Pre-data — caller can send proper 5xx status
      return safeReject(err);
    });

    stream.on('data', (data: any) => {
      if (closed) {
        cleanup();
        return;
      }
      if (!jsonl) {
        if (isFirst) {
          res.write('[\n');
        } else {
          res.write(',\n');
        }
      }
      if (isFirst) {
        isFirst = false;
      }
      if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
        data = JSON.stringify(data);
      }
      res.write(data);
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
    // so the route handler doesn't await indefinitely on a torn-down pipeline.
    stream.on('close', () => safeResolve({ success: closed, error: closed ? undefined : new Error('stream closed before end') }));
  });
}
