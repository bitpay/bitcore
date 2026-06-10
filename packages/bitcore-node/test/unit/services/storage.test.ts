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
});
