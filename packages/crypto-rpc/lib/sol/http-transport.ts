import http from 'http';
import https from 'https';
import { SolKit } from '@bitpay-labs/crypto-wallet-core';
import stableStringify from '@solana/fast-stable-stringify';
import { parseJsonWithBigInts, stringifyJsonWithBigints } from '@solana/rpc-spec-types';
import nodeFetch from 'node-fetch';

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
}

interface PendingRequest {
  controller: AbortController;
  consumers: number;
  promise: Promise<unknown>;
}

/**
 * select the shared Node agent for each request and redirect
 * @param {URL} url - request destination
 * @returns {http.Agent|https.Agent} agent matching the destination protocol
 */
function selectAgent(url: URL) {
  return url.protocol === 'http:' ? http.globalAgent : https.globalAgent;
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
 * create a node-fetch transport with same-turn request coalescing
 * @param {string} url - Solana RPC endpoint
 * @param {Object} [options] - transport configuration
 * @param {Function} [options.fetch] - optional fetch implementation
 * @returns {Function} Solana Kit RPC transport
 */
export function createSolanaHttpTransport(url: string, options: SolanaHttpTransportOptions = {}): SolKit.RpcTransport {
  const fetch: SolanaHttpFetch = options.fetch || nodeFetch;
  let pendingRequests: Map<string, PendingRequest> | undefined;

  /**
   * send a JSON-RPC payload without losing integer precision
   * @param {Object} payload - JSON-RPC request
   * @param {AbortSignal} signal - cancellation signal for the shared request
   * @returns {Promise<Object>} JSON-RPC response
   */
  async function sendRequest(payload: unknown, signal: AbortSignal) {
    try {
      return await fetchAndParse(payload, signal);
    } catch (err) {
      throw redactUrls(err as Error);
    }
  }

  /**
   * POST the payload and parse the JSON-RPC response
   * @param {Object} payload - JSON-RPC request
   * @param {AbortSignal} signal - cancellation signal for the shared request
   * @returns {Promise<Object>} JSON-RPC response
   */
  async function fetchAndParse(payload: unknown, signal: AbortSignal) {
    const response = await fetch(url, {
      method: 'POST',
      agent: selectAgent,
      headers: {
        accept: 'application/json',
        'accept-encoding': 'br,gzip,deflate',
        'content-type': 'application/json; charset=utf-8',
        'solana-client': 'bitcore-crypto-rpc'
      },
      body: stringifyJsonWithBigints(payload),
      signal
    });
    if (!response.ok) {
      // release the response stream when the HTTP status prevents RPC parsing
      if (response.body && typeof response.body.destroy === 'function') {
        response.body.destroy();
      }
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
    if (signal && signal.aborted) {
      return Promise.reject(signal.reason);
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
        promise: sendRequest(payload, controller.signal)
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
        reject(signal.reason);
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
