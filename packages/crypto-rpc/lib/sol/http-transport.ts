import http from 'http';
import https from 'https';
import { Readable } from 'stream';
import { SolKit } from '@bitpay-labs/crypto-wallet-core';
import stableStringify from '@solana/fast-stable-stringify';
import { parseJsonWithBigInts, stringifyJsonWithBigints } from '@solana/rpc-spec-types';
import nodeFetch from 'node-fetch';

/** request timeout used when none is given, matching the native fetch header and body timeouts */
export const DEFAULT_TIMEOUT_MS = 300000;

/** JSON-RPC request as Solana Kit hands it to a transport */
interface JsonRpcPayload {
  method: string;
  params?: unknown;
}

/** The parts of a fetch Response this transport reads; node-fetch's and the WHATWG one both fit */
export interface SolanaHttpFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: any;
  body?: any;
  text(): Promise<string>;
}

/** A fetch implementation the transport can send through: node-fetch by default, or anything shaped like it */
export type SolanaHttpFetch = (url: string, init: Record<string, any>) => Promise<SolanaHttpFetchResponse>;

export interface SolanaHttpTransportOptions {
  /** optional fetch implementation */
  fetch?: SolanaHttpFetch;
  /** ms before a request is aborted and rejected (default 300000, 0 disables) */
  timeout?: number;
}

interface PendingRequest {
  controller: AbortController;
  consumers: number;
  promise: Promise<unknown>;
}

/** node's Agent.addRequest, which node calls for every request but @types/node leaves out */
type TrackableAgent = http.Agent & {
  addRequest(req: http.ClientRequest, options: unknown): void;
};

/**
 * select the shared Node agent for each request and redirect
 * @param {URL} url - request destination
 * @returns {http.Agent|https.Agent} agent matching the destination protocol
 */
function selectAgent(url: URL) {
  return url.protocol === 'http:' ? http.globalAgent : https.globalAgent;
}

/**
 * wrap the shared agent so the transport can see each node request it handles
 * node-fetch 2 never exposes the IncomingMessage, so it is taken from the request here
 * @param {Function} onRequest - called with each http.ClientRequest, including redirects
 * @returns {Function} node-fetch agent option
 */
function trackRequests(onRequest: (req: http.ClientRequest) => void): (url: URL) => http.Agent {
  return (url) => {
    const agent = selectAgent(url) as TrackableAgent;
    const tracked: TrackableAgent = Object.create(agent);
    tracked.addRequest = (req, options) => {
      onRequest(req);
      return agent.addRequest(req, options);
    };
    return tracked;
  };
}

/**
 * cut every URL in an error's message and stack down to its origin
 * node-fetch puts the full request URL in its errors, and provider URLs often carry an API key in the path or query
 * @param {Error} err - error thrown while sending the request or reading the response
 * @returns {Error} the same error, with URLs reduced to scheme and host
 */
function redactUrls(err: Error) {
  const toOrigin = (text: string) => text.replace(/(https?:\/\/)(?:[^\s/?#@]*@)?([^\s/?#]+)[^\s]*/g, '$1$2');
  if (err && typeof err.message === 'string') {
    err.message = toOrigin(err.message);
  }
  if (err && typeof err.stack === 'string') {
    err.stack = toOrigin(err.stack);
  }
  return err;
}

/**
 * get a signal's abort reason as an Error so the rejection has a stack trace
 * @param {AbortSignal} signal - aborted signal
 * @returns {Error} the reason itself if it is an Error, otherwise an Error wrapping it as its cause
 */
function abortError(signal: AbortSignal): Error {
  const { reason } = signal;
  if (reason instanceof Error) {
    return reason;
  }
  let message: string;
  try {
    // String() handles Symbols but throws for objects without a usable toString
    message = String(reason);
  } catch {
    message = 'Request aborted';
  }
  return new Error(message, { cause: reason });
}

/**
 * create a node-fetch transport with same-turn request coalescing
 * @param {string} url - Solana RPC endpoint
 * @param {Object} [options] - transport configuration
 * @param {Function} [options.fetch] - optional fetch implementation
 * @param {number} [options.timeout] - ms before a request is aborted and rejected (default 300000, 0 disables)
 * @returns {Function} Solana Kit RPC transport
 */
export function createSolanaHttpTransport(url: string, options: SolanaHttpTransportOptions = {}): SolKit.RpcTransport {
  const fetch: SolanaHttpFetch = options.fetch || nodeFetch;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  let pendingRequests: Map<string, PendingRequest> | undefined;

  /**
   * send a JSON-RPC payload without losing integer precision
   * @param {Object} payload - JSON-RPC request
   * @param {AbortController} controller - cancels the shared request
   * @returns {Promise<Object>} JSON-RPC response
   */
  async function sendRequest(payload: unknown, controller: AbortController) {
    try {
      return await fetchAndParse(payload, controller);
    } catch (err) {
      throw redactUrls(err as Error);
    }
  }

  /**
   * send the request, aborting it and rejecting once the timeout passes
   * @param {Object} payload - JSON-RPC request
   * @param {AbortController} controller - cancels the shared request
   * @returns {Promise<Object>} JSON-RPC response
   */
  function sendWithTimeout(payload: unknown, controller: AbortController): Promise<unknown> {
    if (!(timeout > 0 && Number.isFinite(timeout))) {
      return sendRequest(payload, controller);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Solana RPC request timed out after ${timeout}ms`));
        controller.abort();
      }, timeout);
      timer.unref();
      sendRequest(payload, controller).then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }

  /**
   * POST the payload and parse the JSON-RPC response
   * @param {Object} payload - JSON-RPC request
   * @param {AbortController} controller - cancels the shared request
   * @returns {Promise<Object>} JSON-RPC response
   */
  async function fetchAndParse(payload: unknown, controller: AbortController) {
    let incoming: http.IncomingMessage | undefined;
    let body: Readable | undefined;

    // node-fetch 2 leaves the body pending forever when the connection drops before Content-Length bytes arrive
    const failTruncatedBody = () => {
      if (body && incoming && !incoming.complete && !body.destroyed) {
        const err: NodeJS.ErrnoException = new Error('Premature close');
        err.code = 'ERR_STREAM_PREMATURE_CLOSE';
        body.destroy(err);
      }
    };
    const agent = trackRequests((req) => {
      req.once('response', (res: http.IncomingMessage) => {
        incoming = res;
        res.once('close', () => {
          if (res === incoming) {
            failTruncatedBody();
          }
        });
      });
    });

    const response = await fetch(url, {
      method: 'POST',
      agent,
      headers: {
        accept: 'application/json',
        'accept-encoding': 'br,gzip,deflate',
        'content-type': 'application/json; charset=utf-8',
        'solana-client': 'bitcore-crypto-rpc'
      },
      body: stringifyJsonWithBigints(payload),
      signal: controller.signal
    });
    if (incoming && response.body && typeof response.body.destroy === 'function') {
      body = response.body;
      // the connection may have dropped before this resumed
      if (incoming.destroyed) {
        failTruncatedBody();
      }
    }
    if (!response.ok) {
      // the body goes unread, so abort to close the connection instead of leaving it paused
      // a body that already arrived in full has released its socket and the abort is a no-op
      controller.abort();
      throw new SolKit.SolanaError(SolKit.SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, {
        headers: response.headers,
        message: response.statusText,
        statusCode: response.status
      });
    }
    return parseJsonWithBigInts(await response.text());
  }

  /**
   * share identical requests within one microtask while isolating caller cancellation
   * @param {Object} request - Solana Kit transport request
   * @param {Object} request.payload - JSON-RPC payload
   * @param {AbortSignal} [request.signal] - cancellation signal for this caller
   * @returns {Promise<Object>} JSON-RPC response
   */
  return function transport({ payload, signal }: { payload: unknown; signal?: AbortSignal }): Promise<any> {
    if (signal?.aborted) {
      return Promise.reject(abortError(signal));
    }
    const { method, params } = payload as JsonRpcPayload;
    if (!pendingRequests) {
      pendingRequests = new Map();
      queueMicrotask(() => {
        pendingRequests = undefined;
      });
    }
    const key = stableStringify([method, params]);
    let pendingRequest = pendingRequests.get(key);
    if (!pendingRequest) {
      const controller = new AbortController();
      pendingRequest = {
        controller,
        consumers: 0,
        promise: sendWithTimeout(payload, controller)
      };
      pendingRequests.set(key, pendingRequest);
    }
    pendingRequest.consumers++;
    if (!signal) {
      return pendingRequest.promise;
    }

    return new Promise((resolve, reject) => {
      let finished = false;

      /**
       * cancel this consumer and abort the network request when no consumers remain
       */
      const handleAbort = () => {
        if (finished) {
          return;
        }
        finished = true;
        signal.removeEventListener('abort', handleAbort);
        pendingRequest.consumers--;
        queueMicrotask(() => {
          if (pendingRequest.consumers === 0) {
            pendingRequest.controller.abort();
          }
        });
        reject(abortError(signal));
      };

      signal.addEventListener('abort', handleAbort, { once: true });
      pendingRequest.promise.then((result) => {
        signal.removeEventListener('abort', handleAbort);
        if (!finished) {
          finished = true;
          return resolve(result);
        }
      }, (error) => {
        signal.removeEventListener('abort', handleAbort);
        if (!finished) {
          finished = true;
          return reject(error);
        }
      });
      if (signal.aborted) {
        handleAbort();
      }
    });
  };
}
