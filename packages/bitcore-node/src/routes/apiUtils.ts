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

    req.on('close', () => { closed = true; tearDown(); });
    res.type('json');
    res.on('close', () => { closed = true; tearDown(); });

    stream.on('error', (err: any) => {
      if (closed) return;
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
        return resolve({ success: false, error: err });
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
        return resolve({ success: false, error: err });
      }
      // Pre-data — caller can send proper 5xx status
      return reject(err);
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
      resolve({ success: true });
    });
  });
}
