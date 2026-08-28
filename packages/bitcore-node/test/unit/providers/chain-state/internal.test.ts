import { expect } from 'chai';
import * as sinon from 'sinon';
import { Readable } from 'stream';
import { InternalStateProvider } from '../../../../src/providers/chain-state/internal/internal';
import { TransactionStorage } from '../../../../src/models/transaction';
import logger from '../../../../src/logger';
import { unitAfterHelper, unitBeforeHelper } from '../../../helpers/unit';

describe('InternalStateProvider: streamWalletTransactions cursor teardown', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  let collectionStub: sinon.SinonStub;
  let warnStub: sinon.SinonStub;
  let cursor: any;
  let cursorClose: sinon.SinonStub;
  let provider: InternalStateProvider;

  const wallet = { _id: 'wallet-id', chain: 'BTC', network: 'mainnet' } as any;
  const params = { chain: 'BTC', network: 'mainnet', wallet, args: {} } as any;

  beforeEach(function() {
    provider = new InternalStateProvider('BTC');
    // push-driven stand-in for the Mongo cursor; close() is the only cursor API under test
    cursor = new Readable({ objectMode: true, read() {} });
    cursorClose = sinon.stub().resolves();
    cursor.close = cursorClose;
    collectionStub = sinon
      .stub(TransactionStorage, 'collection')
      .get(
        () =>
          ({
            find: () => ({
              sort: () => ({
                addCursorFlag: () => cursor
              })
            })
          }) as any
      );
    warnStub = sinon.stub(logger, 'warn');
  });

  afterEach(function() {
    collectionStub.restore();
    warnStub.restore();
  });

  it('closes the cursor once when the stream ends, even though both end and close fire', async function() {
    const stream: any = await provider.streamWalletTransactions(params);
    const ended = new Promise<void>(resolve => stream.on('end', resolve));
    // consume the stream like the route does; a paused readable never emits 'end'
    stream.on('data', () => {});
    cursor.push(null);
    await ended;
    expect(cursorClose.callCount).to.equal(1);
  });

  it('logs a warning when cursor close() rejects instead of leaving the rejection unhandled', async function() {
    cursorClose.rejects(new Error('cursor close failed'));
    const stream: any = await provider.streamWalletTransactions(params);
    const ended = new Promise<void>(resolve => stream.on('end', resolve));
    stream.on('data', () => {});
    cursor.push(null);
    await ended;
    // dispose is async; let the rejected close() settle before asserting
    await new Promise(resolve => setImmediate(resolve));
    expect(warnStub.callCount).to.equal(1);
    expect(warnStub.firstCall.args[0]).to.contain('Failed to close BTC wallet transaction cursor');
  });

  it('closes the cursor when the output stream itself errors before ending', async function() {
    const stream: any = await provider.streamWalletTransactions(params);
    stream.on('error', () => {
      /* swallowed; only the teardown is under test */
    });
    stream.emit('error', new Error('boom'));
    expect(cursorClose.callCount).to.equal(1);
  });

  it('closes the cursor and propagates the error when the underlying cursor errors mid-stream', async function() {
    // Readable.pipe() does not propagate source errors to the destination.
    // Without the cursor error listener, this error is unhandled by the source
    // and the returned transform never receives the failure.
    const stream: any = await provider.streamWalletTransactions(params);
    const observedError = new Promise<Error>(resolve => stream.on('error', resolve));
    const boom = new Error('cursor boom');
    cursor.emit('error', boom);
    expect(await observedError).to.equal(boom);
    expect(cursorClose.callCount).to.equal(1);
    expect(stream.destroyed).to.equal(true);
  });
});
