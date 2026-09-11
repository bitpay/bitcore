import { expect } from 'chai';
import { EventEmitter } from 'events';
import sinon from 'sinon';
import { PassThrough, Readable } from 'stream';
import logger from '../../../src/logger';
import { ExternalApiStream } from '../../../src/providers/chain-state/external/streams/apiStream';
import { streamJsonArray } from '../../../src/routes/apiUtils';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Storage Service', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });
});

describe('mergeStreams', function() {
  it('ends the destination immediately when there are no source streams', async () => {
    const dest = new PassThrough({ objectMode: true });
    const ended = new Promise<void>(resolve => dest.on('end', resolve));
    dest.on('data', () => {});
    ExternalApiStream.mergeStreams([], dest);
    await ended;
  });
});

describe('streamJsonArray', function() {
  // Minimal req/res stand-ins: req only needs 'close', res captures writes and exposes 'close'.
  function fakes() {
    const req = new EventEmitter() as any;
    const writes: string[] = [];
    const res = Object.assign(new EventEmitter(), {
      writableFinished: false,
      type: () => res,
      write: (chunk: any) => { writes.push(typeof chunk === 'string' ? chunk : chunk.toString()); return true; },
      end: () => { res.ended = true; res.writableFinished = true; },
    }) as any;
    return { req, res, writes };
  }

  it('frames objects as a JSON array', async () => {
    const { req, res, writes } = fakes();
    const result = await streamJsonArray(Readable.from([{ a: 1 }, { a: 2 }], { objectMode: true }), req, res);
    expect(result.success).to.equal(true);
    expect(writes.join('')).to.equal('[\n{"a":1},\n{"a":2}\n]');
  });

  it('writes [] for empty stream', async () => {
    const { req, res, writes } = fakes();
    await streamJsonArray(Readable.from([], { objectMode: true }), req, res);
    expect(writes.join('')).to.equal('[]');
  });

  it('honors stream.jsonl flag (no array framing)', async () => {
    const { req, res, writes } = fakes();
    const stream: any = Readable.from(['{"a":1}\n', '{"a":2}\n'], { objectMode: true });
    stream.jsonl = true;
    await streamJsonArray(stream, req, res);
    expect(writes.join('')).to.equal('{"a":1}\n{"a":2}\n');
  });

  it('appends inline error marker on mid-stream error', async () => {
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => {
      stream.push({ a: 1 });
      setImmediate(() => stream.emit('error', new Error('boom')));
    });
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('stream-error');
    expect(writes.join('')).to.contain('"error"');
    expect(writes.join('')).to.match(/,\n\{"error".*\}\n\]$/);
  });

  it('rejects pre-data errors so the route can send a 5xx', async () => {
    const { req, res } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => stream.emit('error', new Error('upstream down')));
    let caught: any;
    await streamJsonArray(stream, req, res).catch(e => caught = e);
    expect(caught).to.be.instanceOf(Error);
    expect(caught.message).to.equal('upstream down');
  });

  it('settles the promise on client disconnect', async () => {
    const { req, res } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => res.emit('close'));
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('client-disconnect');
    expect(result.error?.message).to.contain('disconnected');
  });

  it('calls close() once and skips destroy() on cursor-style streams when the client disconnects', async () => {
    const { req, res } = fakes();
    const stream = new Readable({ objectMode: true, read() {} }) as any;
    let closeCalls = 0;
    let destroyed = false;
    stream.close = () => { closeCalls++; };
    stream.destroy = () => { destroyed = true; };
    setImmediate(() => {
      res.emit('close');
      res.emit('close'); // overlapping terminal events must not re-run teardown
    });
    await streamJsonArray(stream, req, res);
    await new Promise(r => setImmediate(r));
    expect(closeCalls).to.equal(1);
    expect(destroyed).to.equal(false);
  });

  it('treats a response error as a client abort and tears down the source', async () => {
    const { req, res } = fakes();
    const stream = new Readable({ objectMode: true, read() {} }) as any;
    let closeCalls = 0;
    stream.close = () => { closeCalls++; };
    setImmediate(() => {
      res.emit('error', new Error('EPIPE'));
      res.emit('close'); // real responses emit close after error
    });
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('client-disconnect');
    await new Promise(r => setImmediate(r));
    expect(closeCalls).to.equal(1);
  });

  it('ignores request close so body draining cannot abort the stream', async () => {
    // req 'close' fires once the body is consumed; it says nothing about the connection
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => {
      req.emit('close');
      setImmediate(() => {
        stream.push({ a: 1 });
        stream.push(null);
      });
    });
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(true);
    expect(writes.join('')).to.equal('[\n{"a":1}\n]');
  });

  it('does not tear down when the response closes after a normal finish', async () => {
    const { req, res } = fakes();
    const stream = Readable.from([{ a: 1 }], { objectMode: true }) as any;
    let closeCalls = 0;
    stream.close = () => { closeCalls++; };
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(true);
    res.emit('close'); // normal post-finish close
    await new Promise(r => setImmediate(r));
    expect(closeCalls).to.equal(0);
  });

  it('observes a rejected close() promise instead of leaving it unhandled', async () => {
    const warnSpy = sinon.spy(logger, 'warn');
    try {
      const { req, res } = fakes();
      const stream = new Readable({ objectMode: true, read() {} }) as any;
      stream.close = () => Promise.reject(new Error('session ended'));
      setImmediate(() => res.emit('close'));
      await streamJsonArray(stream, req, res);
      await new Promise(r => setImmediate(r));
      expect(warnSpy.called).to.equal(true);
    } finally {
      warnSpy.restore();
    }
  });

  it('finalizes the body when the stream closes without end after data', async () => {
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => {
      stream.push({ a: 1 });
      setImmediate(() => stream.destroy());
    });
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('closed-before-end');
    expect(res.ended).to.equal(true);
    expect(writes.join('')).to.equal('[\n{"a":1},\n{"error": "An error occurred during data stream"}\n]');
  });

  it('rejects when the stream closes without end before any data', async () => {
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => stream.destroy());
    let caught: any;
    await streamJsonArray(stream, req, res).catch(e => caught = e);
    expect(caught).to.be.instanceOf(Error);
    expect(caught.message).to.contain('closed before end');
    expect(writes.join('')).to.equal('');
  });

  it('pauses the source when the response buffer is full and resumes on drain', async () => {
    const { req, res, writes } = fakes();
    // reject writes until drain
    res.write = (chunk: any) => { writes.push(String(chunk)); return false; };
    const stream = new Readable({ objectMode: true, read() {} });
    const promise = streamJsonArray(stream, req, res);
    // count after attach; on('data') itself calls resume()
    let paused = 0;
    let resumed = 0;
    const origPause = stream.pause.bind(stream);
    const origResume = stream.resume.bind(stream);
    stream.pause = () => { paused++; return origPause(); };
    stream.resume = () => { resumed++; return origResume(); };
    setImmediate(() => {
      stream.push({ a: 1 });
      setImmediate(() => {
        expect(paused).to.equal(1);
        expect(resumed).to.equal(0);
        res.write = (chunk: any) => { writes.push(String(chunk)); return true; };
        res.emit('drain');
        expect(resumed).to.equal(1);
        stream.push({ a: 2 });
        stream.push(null);
      });
    });
    const result = await promise;
    expect(result.success).to.equal(true);
    expect(writes.join('')).to.equal('[\n{"a":1},\n{"a":2}\n]');
  });

  it('does not resume the source on drain after the response settled', async () => {
    const { req, res } = fakes();
    res.write = () => false;
    const stream = new Readable({ objectMode: true, read() {} });
    const promise = streamJsonArray(stream, req, res);
    // count after attach; on('data') itself calls resume()
    let resumed = 0;
    const origResume = stream.resume.bind(stream);
    stream.resume = () => { resumed++; return origResume(); };
    setImmediate(() => {
      stream.push({ a: 1 });
      setImmediate(() => {
        res.emit('close'); // client disconnects while paused
        res.emit('drain');
        expect(resumed).to.equal(0);
      });
    });
    const result = await promise;
    expect(result.success).to.equal(false);
  });

  it('serializes BigInt values instead of throwing', async () => {
    const { req, res, writes } = fakes();
    const result = await streamJsonArray(Readable.from([{ a: 1n }], { objectMode: true }), req, res);
    expect(result.success).to.equal(true);
    expect(writes.join('')).to.equal('[\n{"a":"1"}\n]');
  });

  it('rejects an unserializable first element without writing a partial array', async () => {
    const { req, res, writes } = fakes();
    const circular: any = {};
    circular.self = circular;
    let caught: any;
    await streamJsonArray(Readable.from([circular], { objectMode: true }), req, res).catch(e => caught = e);
    expect(caught).to.be.instanceOf(TypeError);
    // The opening '[\n' must not be written for an element we could never serialize
    expect(writes.join('')).to.equal('');
  });

  it('closes the array on an unserializable later element', async () => {
    const { req, res, writes } = fakes();
    const circular: any = {};
    circular.self = circular;
    const result = await streamJsonArray(Readable.from([{ a: 1 }, circular], { objectMode: true }), req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('stream-error');
    // no dangling ',\n'; the separator is only written after serialization succeeds
    expect(writes.join('')).to.equal('[\n{"a":1},\n{"error": "An error occurred during data stream"}\n]');
  });

  const notSupportedError = () => {
    const err: any = new Error('not supported');
    err.log = { data: { message: 'query not supported for this chain' } };
    return err;
  };

  it('writes [] and tears down the source on a pre-data "not supported" error', async () => {
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => stream.emit('error', notSupportedError()));
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('not-supported');
    expect(writes.join('')).to.equal('[]');
    expect(stream.destroyed).to.equal(true);
  });

  it('closes the array like any mid-stream error when "not supported" arrives after data', async () => {
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    setImmediate(() => {
      stream.push({ a: 1 });
      setImmediate(() => stream.emit('error', notSupportedError()));
    });
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('stream-error');
    // body must stay parseable JSON, not '[\n{..}[]'
    expect(writes.join('')).to.equal('[\n{"a":1},\n{"error": "An error occurred during data stream"}\n]');
  });

  it('rejects a stream that was destroyed before piping began', async () => {
    const { req, res, writes } = fakes();
    const stream = new Readable({ objectMode: true, read() {} });
    stream.destroy();
    let caught: any;
    await streamJsonArray(stream, req, res).catch(e => caught = e);
    expect(caught).to.be.instanceOf(Error);
    expect(caught.message).to.contain('destroyed');
    expect(writes.join('')).to.equal('');
  });
});
