import { expect } from 'chai';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { streamJsonArray } from '../../../src/routes/apiUtils';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Storage Service', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });
});

describe('streamJsonArray', function() {
  // Minimal req/res stand-ins: req only needs 'close', res captures writes and exposes 'close'.
  function fakes() {
    const req = new EventEmitter() as any;
    const writes: string[] = [];
    const res = Object.assign(new EventEmitter(), {
      type: () => res,
      write: (chunk: any) => { writes.push(typeof chunk === 'string' ? chunk : chunk.toString()); return true; },
      end: () => { (res as any).ended = true; },
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
    setImmediate(() => req.emit('close'));
    const result = await streamJsonArray(stream, req, res);
    expect(result.success).to.equal(false);
    if (result.success) throw new Error('expected a failure result');
    expect(result.reason).to.equal('client-disconnect');
    expect(result.error?.message).to.contain('disconnected');
  });

  it('calls .close() on cursor-style streams when the client disconnects', async () => {
    const { req, res } = fakes();
    const stream = new Readable({ objectMode: true, read() {} }) as any;
    let closed = false;
    stream.close = () => { closed = true; };
    setImmediate(() => req.emit('close'));
    await streamJsonArray(stream, req, res);
    expect(closed).to.equal(true);
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
