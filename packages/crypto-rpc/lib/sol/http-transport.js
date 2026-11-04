import http from 'http';
import https from 'https';
import { SolKit } from '@bitpay-labs/crypto-wallet-core';
import stableStringify from '@solana/fast-stable-stringify';
import { parseJsonWithBigInts, stringifyJsonWithBigints } from '@solana/rpc-spec-types';
import nodeFetch from 'node-fetch';

/**
 * select the shared Node agent for each request and redirect
 * @param {URL} url - request destination
 * @returns {http.Agent|https.Agent} agent matching the destination protocol
 */
function selectAgent(url) {
  return url.protocol === 'http:' ? http.globalAgent : https.globalAgent;
}

/**
 * create a node-fetch transport with same-turn request coalescing
 * @param {string} url - Solana RPC endpoint
 * @param {Object} [options] - transport configuration
 * @param {Function} [options.fetch] - optional fetch implementation
 * @returns {Function} Solana Kit RPC transport
 */
export function createSolanaHttpTransport(url, options = {}) {
  const fetch = options.fetch || nodeFetch;
  let pendingRequests;

  /**
   * send a JSON-RPC payload without losing integer precision
   * @param {Object} payload - JSON-RPC request
   * @param {AbortSignal} signal - cancellation signal for the shared request
   * @returns {Promise<Object>} JSON-RPC response
   */
  async function sendRequest(payload, signal) {
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
  return function transport({ payload, signal }) {
    if (signal && signal.aborted) {
      return Promise.reject(signal.reason);
    }
    if (!pendingRequests) {
      pendingRequests = new Map();
      queueMicrotask(() => {
        pendingRequests = undefined;
      });
    }
    const key = stableStringify([payload.method, payload.params]);
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
      function handleAbort() {
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
      }

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
