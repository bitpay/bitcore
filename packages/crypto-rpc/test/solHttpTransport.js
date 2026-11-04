import http from 'http';
import { SolKit } from '@bitpay-labs/crypto-wallet-core';
import { expect } from 'chai';
import nodeFetch from 'node-fetch';
import sinon from 'sinon';
import { createSolanaHttpTransport } from '../lib/sol/http-transport.js';
import { SolRpc } from '../lib/sol/SolRpc.js';

describe('SOL HTTP transport', function() {
  this.timeout(5000);
  let server;
  let port;
  let endpoint;
  let requests;
  // Answers each JSON-RPC request; replaced per test. Gets the parsed request and the raw response.
  let respond;

  const slotResponse = id => `{"jsonrpc":"2.0","result":18446744073709551615,"id":${JSON.stringify(id)}}`;

  beforeEach(async function() {
    requests = [];
    respond = (body, res) => res.end(slotResponse(body.id));
    server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        requests.push({ headers: req.headers, body });
        respond(body, res);
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    port = server.address().port;
    endpoint = `http://127.0.0.1:${port}`;
  });

  afterEach(async function() {
    sinon.restore();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const rpcFor = (options) => SolKit.createSolanaRpcFromTransport(createSolanaHttpTransport(endpoint, options));

  it('works as a Kit transport and keeps u64 precision', async function() {
    const slot = await rpcFor().getSlot().send();
    expect(slot).to.equal(18446744073709551615n);
    expect(requests).to.have.lengthOf(1);
    expect(requests[0].body.method).to.equal('getSlot');
    expect(requests[0].headers['solana-client']).to.equal('bitcore-crypto-rpc');
  });

  it('sends identical requests made in the same tick once', async function() {
    const rpc = rpcFor();
    const results = await Promise.all([rpc.getSlot().send(), rpc.getSlot().send()]);
    expect(results).to.deep.equal([18446744073709551615n, 18446744073709551615n]);
    expect(requests).to.have.lengthOf(1);
  });

  it('sends different requests made in the same tick separately', async function() {
    const rpc = rpcFor();
    await Promise.all([rpc.getSlot().send(), rpc.getSlot({ commitment: 'finalized' }).send()]);
    expect(requests).to.have.lengthOf(2);
  });

  it('keeps a shared request going when one of its callers aborts', async function() {
    let release;
    respond = (body, res) => { release = () => res.end(slotResponse(body.id)); };
    const rpc = rpcFor();
    const controller = new AbortController();
    const aborted = rpc.getSlot().send({ abortSignal: controller.signal });
    const kept = rpc.getSlot().send();
    await waitFor(() => release);
    controller.abort();
    let abortError;
    try {
      await aborted;
    } catch (err) {
      abortError = err;
    }
    expect(abortError).to.have.property('name', 'AbortError');
    release();
    expect(await kept).to.equal(18446744073709551615n);
    expect(requests).to.have.lengthOf(1);
  });

  it('keeps a shared request going when one of two signalled callers aborts', async function() {
    let release;
    respond = (body, res) => { release = () => res.end(slotResponse(body.id)); };
    const rpc = rpcFor();
    const first = new AbortController();
    const second = new AbortController();
    const aborted = rpc.getSlot().send({ abortSignal: first.signal });
    const kept = rpc.getSlot().send({ abortSignal: second.signal });
    await waitFor(() => release);
    first.abort();
    let abortError;
    try {
      await aborted;
    } catch (err) {
      abortError = err;
    }
    expect(abortError).to.have.property('name', 'AbortError');
    release();
    expect(await kept).to.equal(18446744073709551615n);
    expect(requests).to.have.lengthOf(1);
  });

  it('aborts the HTTP request when every caller aborts', async function() {
    let responseClosed;
    const closed = new Promise(resolve => { responseClosed = resolve; });
    respond = (body, res) => res.on('close', () => responseClosed(res.writableEnded));
    const controller = new AbortController();
    const call = rpcFor().getSlot().send({ abortSignal: controller.signal });
    await waitFor(() => requests.length);
    controller.abort();
    let abortError;
    try {
      await call;
    } catch (err) {
      abortError = err;
    }
    expect(abortError).to.have.property('name', 'AbortError');
    // the connection closed before the server ever answered
    expect(await closed).to.equal(false);
  });

  it('rejects a caller whose signal is already aborted without sending anything', async function() {
    const controller = new AbortController();
    controller.abort();
    let abortError;
    try {
      await rpcFor().getSlot().send({ abortSignal: controller.signal });
    } catch (err) {
      abortError = err;
    }
    expect(abortError).to.have.property('name', 'AbortError');
    expect(requests).to.have.lengthOf(0);
  });

  it('rejects with a SolanaError carrying the status code on an HTTP error', async function() {
    respond = (body, res) => {
      res.writeHead(503, 'Service Unavailable');
      res.end('down');
    };
    let error;
    try {
      await rpcFor().getSlot().send();
    } catch (err) {
      error = err;
    }
    expect(error).to.be.instanceOf(SolKit.SolanaError);
    expect(SolKit.isSolanaError(error, SolKit.SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)).to.equal(true);
    expect(error.context.statusCode).to.equal(503);
  });

  it('sends requests through the fetch passed in options', async function() {
    const fetch = sinon.spy(nodeFetch);
    expect(await rpcFor({ fetch }).getSlot().send()).to.equal(18446744073709551615n);
    expect(fetch.calledOnce).to.equal(true);
    expect(fetch.firstCall.args[0]).to.equal(endpoint);
  });

  it('is the transport SolRpc uses', async function() {
    const fetch = sinon.spy(nodeFetch);
    const solRpc = new SolRpc({ chain: 'SOL', protocol: 'http', host: '127.0.0.1', port, wsPort: 1, fetch });
    expect(await solRpc.rpc.getSlot().send()).to.equal(18446744073709551615n);
    expect(fetch.calledOnce).to.equal(true);
    expect(requests[0].headers['solana-client']).to.equal('bitcore-crypto-rpc');
  });
});

async function waitFor(condition) {
  while (!condition()) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
