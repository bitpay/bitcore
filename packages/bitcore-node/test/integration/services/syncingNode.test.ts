import { AsyncLocalStorage } from 'async_hooks';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import { Collection } from 'mongodb';
import * as os from 'os';
import * as sinon from 'sinon';
import logger from '../../../src/logger';
import { BitcoinP2PWorker } from '../../../src/modules/bitcoin/p2p';
import { MoralisP2PWorker } from '../../../src/modules/moralis/p2p/p2p';
import { EventStorage } from '../../../src/models/events';
import { EVMBlockStorage } from '../../../src/providers/chain-state/evm/models/block';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import { StateStorage } from '../../../src/models/state';
import { TransactionStorage } from '../../../src/models/transaction';
import { WebhookStorage } from '../../../src/models/webhook';
import { BaseEVMStateProvider } from '../../../src/providers/chain-state/evm/api/csp';
import { Libs } from '../../../src/providers/libs';
import { BaseP2PWorker, P2pManager } from '../../../src/services/p2p';
import { Storage } from '../../../src/services/storage';
import * as utils from '../../../src/utils';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

const chain = 'BTC';
const network = 'heartbeattest';
const key = `syncingNode:${chain}:${network}`;
const PASS = 500;
const FIVE_MINUTES = 5 * 60 * 1000;
const LEASE = 4 * 60 * 1000;
const STOP_WAIT = 15000;
const CLOSE_WAIT = 5000;
// the real clock, for waits in real time; the tests fake Date and performance
const realNow = performance.now.bind(performance);
const otherNode = (time: number) => `otherhost:4242:${time}`;
// a heartbeat with this process's hostname and pid, written by some worker
const node = (id: string) => (time: number) => `${os.hostname()}:${process.pid}:${time}:${id}`;
const ownNode = node('a1b2c3d4e5f6');
const WRITES = [
  'findOneAndUpdate', 'findOneAndReplace', 'updateOne', 'updateMany',
  'replaceOne', 'insertOne', 'insertMany', 'bulkWrite'
];
const READS = ['findOneAndUpdate', 'findOne', 'find'];

class TestWorker extends BaseP2PWorker<any> {
  syncs = 0;

  constructor() {
    super({ chain, network, chainConfig: {} });
    this.chain = chain;
    this.network = network;
  }

  async sync() {
    this.syncs++;
  }

  // like a worker that doesn't track its own timers (e.g. the Moralis worker)
  async stop() {
    this.stopping = true;
    await this.unregisterSyncingNode();
  }
}

const loopContext = new AsyncLocalStorage<LoopDriver>();

// Runs a worker's refreshSyncingNode loop one pass at a time on a fake clock
class LoopDriver {
  loop?: Promise<void>;
  private resume?: () => void;
  private parked?: () => void;

  constructor(
    private worker: BaseP2PWorker<any>,
    private clock: sinon.SinonFakeTimers,
    public nominations: sinon.SinonSpy
  ) {}

  park(ms: number) {
    if (ms !== PASS) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.resume = resolve;
      this.parked!();
    });
  }

  // runs the loop until it parks between passes, or ends
  private async run(release: () => void) {
    const parked = new Promise<void>(resolve => (this.parked = resolve));
    let guard;
    const stuck = new Promise((_, reject) => {
      guard = setTimeout(() => reject(new Error('the pass did not finish')), 5000);
    });
    release();
    try {
      await Promise.race([parked, this.loop!.catch(() => {}), stuck]);
    } finally {
      clearTimeout(guard);
    }
    // registrations queued during the pass with no delay
    this.clock.tick(0);
    await this.settle();
  }

  async settle() {
    await Promise.all(this.nominations.returnValues.map(nomination => nomination.catch(() => {})));
  }

  start() {
    return this.run(() => {
      this.loop = loopContext.run(this, () => this.worker.refreshSyncingNode());
      this.loop.catch(() => {});
    });
  }

  // runs the next pass without moving the clock, for driving several workers on one clock
  async resumePass() {
    await this.settle();
    await this.run(() => this.resume!());
  }

  // advances the clock by one wait, then runs the next pass
  async pass(ms = PASS) {
    this.clock.tick(ms);
    await this.settle();
    await this.run(() => this.resume!());
  }

  // runs passes until the clock reaches time
  async passUntil(time: number) {
    while (Date.now() < time) {
      await this.pass();
    }
  }

  async stop() {
    await loopContext.run(this, () => this.worker.stop());
    this.resume?.();
    await this.loop!.catch(() => {});
  }
}

describe('Syncing node heartbeat', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(60000);
  const sandbox = sinon.createSandbox();
  let collection: Collection;
  let direct: Collection;
  let clock: sinon.SinonFakeTimers;
  let nominations: sinon.SinonSpy;
  let driver: LoopDriver;
  let driving = false;
  let worker: BaseP2PWorker<any>;
  let leaseLost: sinon.SinonSpy;
  // drivers of other workers in a test, stopped after it
  let others: LoopDriver[] = [];
  // a heartbeat written by the worker under test
  const thisNode = (time: number) => `${os.hostname()}:${process.pid}:${time}:${(worker as any).instanceId}`;
  let start: number;

  before(intBeforeHelper);
  after(async () => {
    await Storage.db!.collection('heartbeatTestState').drop().catch(() => {});
    await intAfterHelper(suite);
  });

  beforeEach(async () => {
    direct = Storage.db!.collection('heartbeatTestState');
    await direct.deleteMany({});
    collection = Storage.db!.collection('heartbeatTestState');
    for (const method of new Set([...WRITES, ...READS])) {
      sandbox.spy(collection, method as any);
    }
    sandbox.stub(StateStorage, 'collection').get(() => collection);
    nominations = sandbox.spy(StateStorage, 'selfNominateSyncingNode');
    const realWait = utils.wait;
    sandbox.stub(utils, 'wait').callsFake((ms: number) => {
      const current = loopContext.getStore();
      return current ? current.park(ms) : realWait(ms);
    });
    start = Math.floor(Date.now() / 1000) * 1000;
    clock = sandbox.useFakeTimers({ now: start, toFake: ['Date', 'performance'] });
    leaseLost = sandbox.stub(BaseP2PWorker.prototype as any, 'onLeaseLost');
    // only the loop's own timers run on the fake clock; the Mongo driver keeps real ones
    const loopTimers = new Set<any>();
    const realSetTimeout = global.setTimeout;
    const realClearTimeout = global.clearTimeout;
    sandbox.stub(global, 'setTimeout').callsFake((callback, ms, ...args) => {
      if (!loopContext.getStore()) {
        return realSetTimeout(callback, ms, ...args);
      }
      const timer = clock.setTimeout(callback, ms, ...args);
      loopTimers.add(timer);
      return timer;
    });
    sandbox.stub(global, 'clearTimeout').callsFake(timer => {
      return loopTimers.has(timer) ? clock.clearTimeout(timer) : realClearTimeout(timer);
    });
  });

  afterEach(async () => {
    for (const other of others) {
      await other.stop();
    }
    others = [];
    if (driving) {
      await driver.stop();
      driving = false;
    }
    sandbox.restore();
  });

  function drive(w: BaseP2PWorker<any> = new TestWorker()) {
    worker = w;
    driving = true;
    driver = new LoopDriver(worker, clock, nominations);
    return driver;
  }

  async function setHeartBeat(value: string) {
    await direct.updateOne({}, { $set: { [key]: value } }, { upsert: true });
  }

  async function heartBeat() {
    const state = await direct.findOne({});
    return state && state[key];
  }

  function calls(methods: string[]) {
    return methods.reduce((sum, method) => sum + (collection[method] as sinon.SinonSpy).callCount, 0);
  }

  function bitcoinWorker() {
    const mockPool = function() {};
    (mockPool as any).prototype = { on: sandbox.stub(), connect: sandbox.stub(), once: sandbox.stub() };
    const mockMessages = function() {};
    (mockMessages as any).prototype = {};
    sandbox.stub(Libs, 'get').returns({
      lib: { Networks: { get: sandbox.stub().returns('regtest') } },
      p2p: { Messages: mockMessages, Pool: mockPool, Inventory: { TYPE: { BLOCK: 1, TX: 2 } } }
    } as any);
    const bitcoin = new BitcoinP2PWorker({ chain, network, chainConfig: { trustedPeers: [], rpc: {} } });
    sandbox.stub(bitcoin, 'disconnect').resolves();
    sandbox.stub(bitcoin, 'sync').resolves(true);
    sandbox.stub((bitcoin as any).multiThreadSync, 'stop');
    return bitcoin;
  }

  function moralisWorker({ syncs = false } = {}) {
    sandbox.stub(BaseEVMStateProvider, 'initializeRpcs');
    const moralis = new MoralisP2PWorker({ chain, network, chainConfig: { syncIntervalSecs: 0.001 } });
    if (!syncs) {
      sandbox.stub(moralis, 'sync').resolves();
    }
    return moralis;
  }

  // a lost lease stops the worker through onLeaseLost, without failing the loop
  function expectLeaseLost(error, w: BaseP2PWorker<any> = worker) {
    expect(error).to.equal(undefined);
    expect(leaseLost.callCount).to.equal(1);
    expect(leaseLost.firstCall.thisValue).to.equal(w);
  }

  // whether the worker starts a write now
  async function admits(w: BaseP2PWorker<any>) {
    let ran = false;
    await (w as any).write(async () => {
      ran = true;
    });
    return ran;
  }

  // drives another worker's loop on the same clock as the main one
  function driveOther(w: BaseP2PWorker<any>) {
    const other = new LoopDriver(w, clock, nominations);
    others.push(other);
    return other;
  }

  // one wait for every loop, then the next pass of each
  async function passAll(...drivers: LoopDriver[]) {
    clock.tick(PASS);
    for (const d of drivers) {
      await d.resumePass();
    }
  }

  // stops the worker while its next heartbeat read is pending
  function stopDuringNextRead() {
    const read = StateStorage.findSyncingNode.bind(StateStorage);
    let reads = 0;
    sandbox.stub(StateStorage, 'findSyncingNode').callsFake(async params => {
      const value = await read(params);
      if (!reads++) {
        await worker.stop();
      }
      return value;
    });
  }

  async function flush() {
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  // waits in real time; the fake clock only covers Date and the loop's timers
  async function until(condition: () => boolean) {
    const deadline = realNow() + 5000;
    while (!condition()) {
      if (realNow() > deadline) {
        throw new Error('timed out waiting');
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  function pendingLoopTimers() {
    return Object.keys((clock as any).timers || {}).length;
  }

  describe('StateModel', () => {
    it('getSyncingNode creates the state document when there is none and returns undefined', async () => {
      expect(await StateStorage.getSyncingNode({ chain, network })).to.equal(undefined);
      const docs = await direct.find({}).toArray();
      expect(docs.length).to.equal(1);
      expect(docs[0]).to.not.have.property(key);
    });

    it('getSyncingNode returns the heartbeat without changing the state document', async () => {
      await setHeartBeat(otherNode(start));
      const before = await direct.find({}).toArray();
      expect(await StateStorage.getSyncingNode({ chain, network })).to.equal(otherNode(start));
      expect(await direct.find({}).toArray()).to.deep.equal(before);
    });

    it('selfNominateSyncingNode claims a missing heartbeat and renews only the heartbeat it was given', async () => {
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined, heartBeat: ownNode(start) });
      expect(await heartBeat()).to.equal(ownNode(start));

      clock.tick(1000);
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: otherNode(start), heartBeat: ownNode(start + 1000) });
      expect(await heartBeat()).to.equal(ownNode(start));

      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: ownNode(start), heartBeat: ownNode(start + 1000) });
      expect(await heartBeat()).to.equal(ownNode(start + 1000));
      expect(await direct.countDocuments({})).to.equal(1);
    });

    it('selfNominateSyncingNode does not renew a heartbeat that has been removed', async () => {
      await setHeartBeat(ownNode(start - 1000));
      await direct.updateOne({}, { $unset: { [key]: true } });
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: ownNode(start - 1000), heartBeat: ownNode(start) });
      expect(await heartBeat()).to.equal(undefined);
    });

    it('selfNominateSyncingNode writes the heartbeat it is given', async () => {
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined, heartBeat: 'given:1:2:3' });
      expect(await heartBeat()).to.equal('given:1:2:3');
    });

    it('selfNominateSyncingNode claims a missing heartbeat when the previous one is empty', async () => {
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: '', heartBeat: ownNode(start) });
      expect(await heartBeat()).to.equal(ownNode(start));
    });

    it('selfNominateSyncingNode without a previous heartbeat leaves another node\'s heartbeat', async () => {
      await setHeartBeat(otherNode(start));
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined, heartBeat: ownNode(start) });
      expect(await heartBeat()).to.equal(otherNode(start));
    });

    it('the heartbeat queries leave other chains\' heartbeats alone', async () => {
      const others = {
        [`syncingNode:${chain}:othernet`]: otherNode(start),
        [`syncingNode:BCH:${network}`]: otherNode(start)
      };
      await direct.insertOne({ ...others });
      expect(await StateStorage.getSyncingNode({ chain, network })).to.equal(undefined);
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined, heartBeat: ownNode(start) });
      expect(await heartBeat()).to.equal(ownNode(start));
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: ownNode(start) });
      const [state] = await direct.find({}).toArray();
      expect(state).to.not.have.property(key);
      for (const [otherKey, value] of Object.entries(others)) {
        expect(state).to.have.property(otherKey, value);
      }
    });

    it('findSyncingNode returns the heartbeat and the id of the state document', async () => {
      await setHeartBeat(otherNode(start));
      const { _id } = (await direct.findOne({}))!;
      const found = await StateStorage.findSyncingNode({ chain, network });
      expect(found.heartBeat).to.equal(otherNode(start));
      expect(found.stateId.toString()).to.equal(_id.toString());
    });

    it('selfNominateSyncingNode and selfResignSyncingNode given the state document id do not read it', async () => {
      await setHeartBeat(otherNode(start));
      const { _id } = (await direct.findOne({}))!;
      const readsBefore = calls(['findOne']);
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: otherNode(start), stateId: _id, heartBeat: ownNode(start) });
      const nominated = await heartBeat();
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: ownNode(start), stateId: _id });
      expect(calls(['findOne']) - readsBefore).to.equal(0);
      expect(nominated).to.equal(ownNode(start));
      expect(await heartBeat()).to.equal(undefined);
    });

    it('selfNominateSyncingNode and selfResignSyncingNode without the id read the state document without writing it', async () => {
      await setHeartBeat(otherNode(start));
      const readsBefore = calls(['findOne']);
      const writesBefore = calls(WRITES);
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: otherNode(start), heartBeat: ownNode(start) });
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: ownNode(start) });
      expect(calls(['findOne']) - readsBefore).to.equal(2);
      expect(calls(WRITES) - writesBefore).to.equal(2);
      expect(await heartBeat()).to.equal(undefined);
    });

    it('selfResignSyncingNode removes only the heartbeat it was given', async () => {
      await setHeartBeat(otherNode(start));
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: ownNode(start) });
      expect(await heartBeat()).to.equal(otherNode(start));
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: otherNode(start) });
      expect(await heartBeat()).to.equal(undefined);
    });
  });

  describe('refreshSyncingNode', () => {
    it('claims a missing heartbeat, then becomes the syncing node and syncs once', async () => {
      const testWorker = new TestWorker();
      await drive(testWorker).start();
      expect(await heartBeat()).to.equal(thisNode(start));
      expect(testWorker.isSyncingNode).to.equal(false);
      expect(testWorker.syncs).to.equal(0);

      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(true);
      expect(testWorker.syncs).to.equal(1);
    });

    it('renews its heartbeat on every pass while it is the syncing node', async () => {
      const testWorker = new TestWorker();
      await drive(testWorker).start();
      while (Date.now() < start + 2 * FIVE_MINUTES) {
        await driver.pass();
        expect(await heartBeat()).to.equal(thisNode(Date.now()));
        expect(testWorker.isSyncingNode).to.equal(true);
      }
      expect(testWorker.syncs).to.equal(1);
    });

    it('does not take over from another node that keeps renewing its heartbeat', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start));
      await drive(testWorker).start();
      while (Date.now() < start + 3 * FIVE_MINUTES) {
        await driver.pass();
        if ((Date.now() - start) % 2000 === 0) {
          await setHeartBeat(otherNode(Date.now()));
        }
      }
      expect(await heartBeat()).to.match(/^otherhost:/);
      expect(testWorker.isSyncingNode).to.equal(false);
      expect(testWorker.syncs).to.equal(0);
    });

    it('takes over five minutes after another node stops renewing its heartbeat', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start - 60000));
      await drive(testWorker).start();
      await driver.passUntil(start + FIVE_MINUTES - PASS);
      expect(await heartBeat()).to.equal(otherNode(start - 60000));
      expect(testWorker.isSyncingNode).to.equal(false);

      await driver.pass();
      expect(await heartBeat()).to.equal(thisNode(start + FIVE_MINUTES));
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(true);
      expect(testWorker.syncs).to.equal(1);
    });

    it('restarts the five minutes when the other node renews its heartbeat', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start));
      await drive(testWorker).start();
      await driver.passUntil(start + 4 * 60 * 1000);
      const renewedAt = Date.now();
      await setHeartBeat(otherNode(renewedAt));
      await driver.pass();
      const seenAt = Date.now();

      await driver.passUntil(seenAt + FIVE_MINUTES - PASS);
      expect(await heartBeat()).to.equal(otherNode(renewedAt));
      await driver.pass();
      expect(await heartBeat()).to.equal(thisNode(seenAt + FIVE_MINUTES));
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(true);
    });

    it('does not overwrite a node that took over the stale heartbeat first', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start - 60000));
      await drive(testWorker).start();
      await driver.passUntil(start + FIVE_MINUTES - PASS);
      await setHeartBeat('thirdhost:99:1');
      await driver.passUntil(start + 2 * FIVE_MINUTES - PASS);
      expect(await heartBeat()).to.equal('thirdhost:99:1');
      expect(testWorker.isSyncingNode).to.equal(false);
      expect(testWorker.syncs).to.equal(0);
    });

    it('retries a takeover that fails on the next pass', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start - 60000));
      await drive(testWorker).start();
      await driver.passUntil(start + FIVE_MINUTES - PASS);
      const nominate = StateStorage.selfNominateSyncingNode.bind(StateStorage);
      let attempts = 0;
      nominations.restore();
      driver.nominations = sandbox.stub(StateStorage, 'selfNominateSyncingNode').callsFake(params => {
        return attempts++ ? nominate(params) : Promise.reject(new Error('takeover failed'));
      });
      await driver.pass();
      expect(await heartBeat()).to.equal(otherNode(start - 60000));
      await driver.pass();
      expect(await heartBeat()).to.equal(thisNode(start + FIVE_MINUTES + PASS));
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(true);
    });

    it('claims the heartbeat on the next pass after the other node resigns', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start));
      await drive(testWorker).start();
      await driver.passUntil(start + 60000);
      await direct.updateOne({}, { $unset: { [key]: true } });
      await driver.pass();
      expect(await heartBeat()).to.equal(thisNode(Date.now()));
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(true);
      expect(testWorker.syncs).to.equal(1);
    });

    it('gives up as the syncing node when another node replaces its heartbeat', async () => {
      await drive().start();
      await driver.pass();
      expect(worker.isSyncingNode).to.equal(true);
      await setHeartBeat(otherNode(Date.now()));
      await driver.pass();
      let error;
      await driver.loop!.catch(e => (error = e));
      expectLeaseLost(error);
      expect(worker.isSyncingNode).to.equal(false);
    });

    it('gives up as the syncing node four minutes after its renewals start failing', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      const lastRenewal = Date.now();
      nominations.restore();
      driver.nominations = sandbox.stub(StateStorage, 'selfNominateSyncingNode').rejects(new Error('renewal failed'));
      await driver.passUntil(lastRenewal + LEASE - PASS);
      expect(testWorker.isSyncingNode).to.equal(true);
      expect(error).to.equal(undefined);

      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(false);
      expectLeaseLost(error);
      expect(await heartBeat()).to.equal(thisNode(lastRenewal));
    });

    it('gives up as the syncing node four minutes after a renewal stalls', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      const lastRenewal = Date.now();
      const nominate = StateStorage.selfNominateSyncingNode.bind(StateStorage);
      let unstall;
      const stalled = new Promise(resolve => (unstall = resolve));
      nominations.restore();
      const stub = sandbox.stub(StateStorage, 'selfNominateSyncingNode').callsFake(async params => {
        await stalled;
        return nominate(params);
      });
      // settle() would wait on the stalled renewal
      driver.nominations = sandbox.spy();
      try {
        await driver.passUntil(lastRenewal + LEASE - PASS);
        expect(testWorker.isSyncingNode).to.equal(true);
        // a renewal that lands too late to be read before the lease ends does not extend it
        unstall();
        await Promise.all(stub.returnValues);
        // stamped when the renewal started
        expect(await heartBeat()).to.equal(thisNode(lastRenewal + PASS));
        await driver.pass();
        expect(testWorker.isSyncingNode).to.equal(false);
        expectLeaseLost(error);
        // one renewal at a time
        expect(stub.callCount).to.equal(1);
      } finally {
        unstall();
      }
    });

    it('gives up as the syncing node when a heartbeat read is still pending four minutes after its last renewal', async () => {
      await drive().start();
      await driver.pass();
      expect(worker.isSyncingNode).to.equal(true);
      // the heartbeat this pass read was claimed when the loop started
      const lastRenewal = start;
      let error;
      driver.loop!.catch(e => (error = e));
      const read = StateStorage.findSyncingNode.bind(StateStorage);
      let unstall;
      const stalled = new Promise(resolve => (unstall = resolve));
      let reads = 0;
      sandbox.stub(StateStorage, 'findSyncingNode').callsFake(params => {
        return reads++ ? read(params) : stalled.then(() => read(params));
      });
      try {
        const passing = driver.pass().catch(() => {});
        await until(() => reads > 0);
        clock.tick(lastRenewal + LEASE - 1 - Date.now());
        await flush();
        expect(worker.isSyncingNode).to.equal(true);
        expect(error).to.equal(undefined);
        clock.tick(1);
        await passing;
        expect(worker.isSyncingNode).to.equal(false);
        expectLeaseLost(error);
      } finally {
        unstall();
      }
    });

    it('does not take over when it stops during the heartbeat read', async () => {
      await setHeartBeat(otherNode(start - 60000));
      await drive().start();
      await driver.passUntil(start + FIVE_MINUTES - PASS);
      stopDuringNextRead();
      await driver.pass();
      expect(await heartBeat()).to.equal(otherNode(start - 60000));
    });

    it('does not start syncing when it stops during the read that would make it the syncing node', async () => {
      const testWorker = new TestWorker();
      await drive(testWorker).start();
      stopDuringNextRead();
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(false);
      expect(testWorker.syncs).to.equal(0);
    });

    it('does not fail when it stops during the read that shows another node took over', async () => {
      await drive().start();
      await driver.pass();
      expect(worker.isSyncingNode).to.equal(true);
      let error;
      driver.loop!.catch(e => (error = e));
      await setHeartBeat(otherNode(Date.now()));
      stopDuringNextRead();
      await driver.pass();
      await driver.loop!.catch(() => {});
      expect(error).to.equal(undefined);
    });

    it('resigns after a renewal that is in flight when it stops', async () => {
      await drive().start();
      await driver.pass();
      expect(worker.isSyncingNode).to.equal(true);
      const nominate = StateStorage.selfNominateSyncingNode.bind(StateStorage);
      const resign = StateStorage.selfResignSyncingNode.bind(StateStorage);
      let unstall;
      const stalled = new Promise(resolve => (unstall = resolve));
      let resigned;
      const resignation = new Promise(resolve => (resigned = resolve));
      nominations.restore();
      const stub = sandbox.stub(StateStorage, 'selfNominateSyncingNode').callsFake(async params => {
        await stalled;
        return nominate(params);
      });
      sandbox.stub(StateStorage, 'selfResignSyncingNode').callsFake(async params => {
        const result = await resign(params);
        resigned();
        return result;
      });
      driver.nominations = sandbox.spy();
      try {
        const passing = driver.pass().catch(() => {});
        await until(() => stub.called);
        const stopped = loopContext.run(driver, () => worker.stop());
        // the renewal lands after the resignation, or while stop() waits on it
        await Promise.race([resignation, new Promise(resolve => setTimeout(resolve, 200))]);
        unstall();
        await stopped;
        await Promise.all(stub.returnValues);
        await passing;
        expect(await heartBeat()).to.equal(undefined);
        expect(pendingLoopTimers()).to.equal(0);
      } finally {
        unstall();
      }
    });

    it('leaves its heartbeat to expire when a renewal has not settled fifteen seconds after stopping', async () => {
      await drive().start();
      await driver.pass();
      let unstall;
      const stalled = new Promise(resolve => (unstall = resolve));
      nominations.restore();
      const stub = sandbox.stub(StateStorage, 'selfNominateSyncingNode').returns(stalled);
      driver.nominations = sandbox.spy();
      try {
        await driver.pass();
        expect(stub.callCount).to.equal(1);
        let stopped = false;
        const stopping = loopContext.run(driver, () => worker.stop()).then(() => (stopped = true));
        await until(() => pendingLoopTimers() > 0);
        clock.tick(STOP_WAIT - 1);
        await flush();
        expect(stopped).to.equal(false);
        clock.tick(1);
        await stopping;
        expect(await heartBeat()).to.equal(thisNode(start + PASS));
      } finally {
        unstall();
      }
    });

    it('does not take a heartbeat with its hostname and pid from another process as its own', async () => {
      const testWorker = new TestWorker();
      const twin = `${os.hostname()}:${process.pid}:${start}:000000000000`;
      await setHeartBeat(twin);
      await drive(testWorker).start();
      await driver.passUntil(start + 60000);
      expect(testWorker.isSyncingNode).to.equal(false);
      expect(testWorker.syncs).to.equal(0);
      expect(await heartBeat()).to.equal(twin);
    });

    it('keeps its lease through a failed heartbeat read', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      const reads = sandbox.stub(StateStorage, 'findSyncingNode').callThrough();
      reads.onFirstCall().rejects(new Error('read failed'));
      await driver.pass();
      expect(error).to.equal(undefined);
      expect(testWorker.isSyncingNode).to.equal(true);
      expect(pendingLoopTimers()).to.equal(0);
      await driver.pass();
      expect(await heartBeat()).to.equal(thisNode(Date.now()));
      expect(testWorker.syncs).to.equal(1);
    });

    it('gives up as the syncing node when its heartbeat reads keep failing for four minutes', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      const lastRenewal = start;
      sandbox.stub(StateStorage, 'findSyncingNode').rejects(new Error('read failed'));
      await driver.passUntil(lastRenewal + LEASE - PASS);
      expect(testWorker.isSyncingNode).to.equal(true);
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(false);
      expectLeaseLost(error);
    });

    it('keeps waiting to take over through a failed heartbeat read', async () => {
      const testWorker = new TestWorker();
      let error;
      await setHeartBeat(otherNode(start - 60000));
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      const reads = sandbox.stub(StateStorage, 'findSyncingNode').callThrough();
      reads.onSecondCall().rejects(new Error('read failed'));
      await driver.passUntil(start + FIVE_MINUTES);
      expect(error).to.equal(undefined);
      expect(await heartBeat()).to.equal(thisNode(start + FIVE_MINUTES));
    });

    it('gives up as the syncing node when the loop resumes after a pause longer than its lease', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      clock.tick(LEASE + 3000);
      // even though the heartbeat it would read is its own and fresh
      await setHeartBeat(thisNode(Date.now()));
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(false);
      expectLeaseLost(error);
    });

    it('logs another node holding the heartbeat only when that node changes', async () => {
      const info = sandbox.spy(logger, 'info');
      const standbyLogs = () => info.getCalls().filter(call => /is the syncing node for/.test(call.args[0])).length;
      await setHeartBeat(otherNode(start));
      await drive().start();
      while (Date.now() < start + 2 * FIVE_MINUTES) {
        await driver.pass();
        await setHeartBeat(otherNode(Date.now()));
      }
      expect(standbyLogs()).to.equal(1);
      await setHeartBeat(`thirdhost:99:${Date.now()}`);
      await driver.pass();
      await driver.pass();
      expect(standbyLogs()).to.equal(2);
      // the same host, another process
      await setHeartBeat(`thirdhost:100:${Date.now()}`);
      await driver.pass();
      expect(standbyLogs()).to.equal(3);
    });

    it('gives up four minutes of elapsed time after its last renewal even when the wall clock steps back', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      nominations.restore();
      driver.nominations = sandbox.stub(StateStorage, 'selfNominateSyncingNode').rejects(new Error('renewal failed'));
      // the renewal read back on the next pass started on this one
      const passesLeft = LEASE / PASS;
      for (let i = 1; i < passesLeft; i++) {
        await driver.pass();
        if (i === 120) {
          clock.setSystemTime(Date.now() - 2 * FIVE_MINUTES);
        }
      }
      expect(testWorker.isSyncingNode).to.equal(true);
      await driver.pass();
      expect(testWorker.isSyncingNode).to.equal(false);
      expectLeaseLost(error);
    });

    it('takes over after five minutes of elapsed time even when the wall clock steps forward', async () => {
      const testWorker = new TestWorker();
      await setHeartBeat(otherNode(start - 60000));
      await drive(testWorker).start();
      for (let i = 1; i < FIVE_MINUTES / PASS; i++) {
        await driver.pass();
        if (i === 120) {
          clock.setSystemTime(Date.now() + 2 * FIVE_MINUTES);
        }
      }
      expect(await heartBeat()).to.equal(otherNode(start - 60000));
      await driver.pass();
      expect(await heartBeat()).to.equal(thisNode(Date.now()));
    });

    it('stops admitting writes as soon as another node replaces its heartbeat, while its lease would still run', async () => {
      const testWorker = new TestWorker();
      let error;
      await drive(testWorker).start();
      driver.loop!.catch(e => (error = e));
      await driver.pass();
      expect(await admits(testWorker)).to.equal(true);
      await setHeartBeat(otherNode(Date.now()));
      await driver.pass();
      expect(await admits(testWorker)).to.equal(false);
      await driver.loop;
      expectLeaseLost(error);
    });

    it('writes heartbeats that carry its hostname, pid, the time and its own id', async () => {
      await drive().start();
      const [hostname, pid, time, id] = (await heartBeat()).split(':');
      expect([hostname, pid, time]).to.deep.equal([os.hostname(), `${process.pid}`, `${start}`]);
      expect(id).to.match(/^[0-9a-f]{12}$/);
      expect(id).to.not.equal((new TestWorker() as any).instanceId);
    });

    it('stops looping once the worker is stopping', async () => {
      await drive().start();
      await driver.pass();
      worker['stopping'] = true;
      await driver.pass();
      await driver.loop;
      const renewal = await heartBeat();
      clock.tick(FIVE_MINUTES * 2);
      await driver.settle();
      expect(await heartBeat()).to.equal(renewal);
    });

    // master reads with findOneAndUpdate, which always goes to the primary
    it('reads the heartbeat from the primary', async () => {
      await setHeartBeat(otherNode(start));
      await drive().start();
      await driver.passUntil(start + 2 * FIVE_MINUTES);
      for (const method of ['findOne', 'find']) {
        for (const call of (collection[method] as sinon.SinonSpy).getCalls()) {
          expect(call.args[1]).to.have.property('readPreference', 'primary');
        }
      }
      expect(calls(READS)).to.be.greaterThan(0);
    });
  });

  describe('unregisterSyncingNode', () => {
    it('resigns as the syncing node on stop', async () => {
      await drive().start();
      await driver.pass();
      expect(worker.isSyncingNode).to.equal(true);
      await driver.stop();
      expect(await heartBeat()).to.equal(undefined);
    });

    it('resigns on stop with one read of the state document', async () => {
      await drive().start();
      await driver.pass();
      const readsBefore = calls(['findOne']);
      await driver.stop();
      expect(await heartBeat()).to.equal(undefined);
      expect(calls(['findOne']) - readsBefore).to.equal(1);
    });

    it('leaves another node\'s heartbeat on stop', async () => {
      await setHeartBeat(otherNode(start));
      await drive().start();
      await driver.pass();
      await driver.stop();
      expect(await heartBeat()).to.equal(otherNode(start));
    });

    it('does not resign a heartbeat older than its lease', async () => {
      await drive().start();
      await driver.pass();
      // past the lease, before a standby could take over
      clock.tick(LEASE + 30000);
      await driver.stop();
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
    });

    it('swallows errors while resigning', async () => {
      await drive().start();
      await driver.pass();
      sandbox.stub(StateStorage, 'findSyncingNode').rejects(new Error('read failed'));
      await driver.stop();
      expect(await heartBeat()).to.match(new RegExp(`^${os.hostname()}:`));
    });
  });

  describe('writes on stop', () => {
    // starts a write that finishes when the returned function is called
    function stalledWrite(write: (fn: () => Promise<any>) => Promise<any>) {
      let finish;
      const finished = new Promise(resolve => (finish = resolve));
      const writing = write(() => finished);
      return () => {
        finish();
        return writing;
      };
    }

    async function becomeSyncingNode(w: BaseP2PWorker<any>) {
      await drive(w).start();
      await driver.pass();
      expect(w.isSyncingNode).to.equal(true);
    }

    function stop() {
      return loopContext.run(driver, () => worker.stop());
    }

    it('resigns only once the writes in flight finish', async () => {
      await becomeSyncingNode(new TestWorker());
      const finish = stalledWrite(fn => (worker as any).write(fn));
      const stopping = stop();
      await until(() => pendingLoopTimers() > 0);
      await flush();
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
      await finish();
      await stopping;
      expect(await heartBeat()).to.equal(undefined);
    });

    it('leaves its heartbeat to expire when writes have not finished fifteen seconds after stopping', async () => {
      await becomeSyncingNode(new TestWorker());
      const finish = stalledWrite(fn => (worker as any).write(fn));
      let stopped = false;
      const stopping = stop().then(() => (stopped = true));
      await until(() => pendingLoopTimers() > 0);
      clock.tick(STOP_WAIT - 1);
      await flush();
      expect(stopped).to.equal(false);
      clock.tick(1);
      await stopping;
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
      await finish();
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
    });

    it('does not start a write once its lease has run out, before the loop notices', async () => {
      const testWorker = new TestWorker();
      await becomeSyncingNode(testWorker);
      // the lease the last pass confirmed was claimed at start
      clock.tick(start + LEASE - 1 - Date.now());
      const write = sandbox.stub().resolves();
      await (testWorker as any).write(write);
      expect(write.callCount).to.equal(1);
      clock.tick(1);
      await (testWorker as any).write(write);
      expect(write.callCount).to.equal(1);
      expect(testWorker.isSyncingNode).to.equal(true);
    });

    it('a standby in the election starts no writes', async () => {
      await setHeartBeat(otherNode(start));
      await drive().start();
      await driver.pass();
      expect(await admits(worker)).to.equal(false);
    });

    it('starts no writes after claiming the heartbeat until it reads the claim back', async () => {
      await drive().start();
      expect(await heartBeat()).to.equal(thisNode(start));
      expect(await admits(worker)).to.equal(false);
      await driver.pass();
      expect(await admits(worker)).to.equal(true);
    });

    it('asks the process to stop when its lease is lost', async () => {
      leaseLost.restore?.();
      const kill = sandbox.stub(process, 'kill');
      (new TestWorker() as any).onLeaseLost();
      expect(kill.calledOnceWith(process.pid, 'SIGTERM')).to.equal(true);
    });

    it('leaves its heartbeat when the resign read has not finished by the stop deadline', async () => {
      await becomeSyncingNode(new TestWorker());
      let release;
      sandbox.stub(StateStorage, 'findSyncingNode').returns(new Promise(resolve => (release = resolve)) as any);
      const warn = sandbox.spy(logger, 'warn');
      try {
        let stopped = false;
        const stopping = stop().then(() => (stopped = true));
        await until(() => pendingLoopTimers() > 0);
        clock.tick(STOP_WAIT - 1);
        await flush();
        expect(stopped).to.equal(false);
        clock.tick(1);
        await until(() => stopped);
        await stopping;
        expect(await heartBeat()).to.equal(thisNode(start + PASS));
        expect(warn.getCalls().some(call => /resign/.test(call.args[0]))).to.equal(true);
      } finally {
        release();
      }
    });

    it('leaves its heartbeat when the resign update has not finished by the stop deadline', async () => {
      await becomeSyncingNode(new TestWorker());
      let release;
      sandbox.stub(StateStorage, 'selfResignSyncingNode').returns(new Promise(resolve => (release = resolve)) as any);
      try {
        let stopped = false;
        const stopping = stop().then(() => (stopped = true));
        await until(() => pendingLoopTimers() > 0);
        clock.tick(STOP_WAIT - 1);
        await flush();
        expect(stopped).to.equal(false);
        clock.tick(1);
        await until(() => stopped);
        await stopping;
        expect(await heartBeat()).to.equal(thisNode(start + PASS));
      } finally {
        release();
      }
    });

    it('has one deadline for draining its writes and resigning', async () => {
      const testWorker = new TestWorker();
      await becomeSyncingNode(testWorker);
      const finish = stalledWrite(fn => (testWorker as any).write(fn));
      let release;
      sandbox.stub(StateStorage, 'findSyncingNode').returns(new Promise(resolve => (release = resolve)) as any);
      try {
        let stopped = false;
        const stopping = stop().then(() => (stopped = true));
        await until(() => pendingLoopTimers() > 0);
        clock.tick(10000);
        await finish();
        await flush();
        clock.tick(STOP_WAIT - 10000 - 1);
        await flush();
        expect(stopped).to.equal(false);
        clock.tick(1);
        await until(() => stopped);
        await stopping;
        expect(await heartBeat()).to.equal(thisNode(start + PASS));
      } finally {
        await finish();
        release();
      }
    });

    it('a moralis worker whose webhook tail does not close still resigns', async () => {
      const moralis = moralisWorker();
      await becomeSyncingNode(moralis);
      let release;
      const closing = new Promise(resolve => (release = resolve));
      (moralis as any).webhookTail = { close: () => closing };
      try {
        let stopped = false;
        const stopping = stop().then(() => (stopped = true));
        await until(() => pendingLoopTimers() > 0);
        clock.tick(CLOSE_WAIT);
        await until(() => stopped);
        await stopping;
        expect(await heartBeat()).to.equal(undefined);
      } finally {
        release();
      }
    });

    it('a worker outside the election writes', async () => {
      const write = sandbox.stub().resolves();
      await (new TestWorker() as any).write(write);
      expect(write.callCount).to.equal(1);
    });

    it('a failed write fails for its caller and does not hold up resigning', async () => {
      const testWorker = new TestWorker();
      await becomeSyncingNode(testWorker);
      let fail;
      const failed = (testWorker as any).write(() => new Promise((_, reject) => (fail = reject)));
      let error;
      failed.catch(e => (error = e));
      const stopping = stop();
      await until(() => pendingLoopTimers() > 0);
      fail(new Error('write failed'));
      await stopping;
      expect(error).to.be.an('error').with.property('message', 'write failed');
      expect(await heartBeat()).to.equal(undefined);
    });

    it('forgets writes once they finish or fail', async () => {
      const testWorker = new TestWorker();
      await (testWorker as any).write(() => Promise.resolve());
      await (testWorker as any).write(() => Promise.reject(new Error('write failed'))).catch(() => {});
      expect((testWorker as any).writes.size).to.equal(0);
    });

    it('does not start a write once stopping', async () => {
      const testWorker = new TestWorker();
      await becomeSyncingNode(testWorker);
      await stop();
      const write = sandbox.stub().resolves();
      await (testWorker as any).write(write);
      expect(write.called).to.equal(false);
    });

    it('a bitcoin worker resigns only once the block it is processing is written', async () => {
      const bitcoin = bitcoinWorker();
      await becomeSyncingNode(bitcoin);
      const addBlock = sandbox.stub((bitcoin as any).blockModel, 'addBlock');
      const finish = stalledWrite(fn => {
        addBlock.callsFake(fn);
        return bitcoin.processBlock({} as any);
      });
      const stopping = stop();
      await until(() => pendingLoopTimers() > 0);
      await flush();
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
      await finish();
      await stopping;
      expect(await heartBeat()).to.equal(undefined);
    });

    it('a stopping bitcoin worker writes no more blocks or transactions', async () => {
      const bitcoin = bitcoinWorker();
      await becomeSyncingNode(bitcoin);
      const addBlock = sandbox.stub((bitcoin as any).blockModel, 'addBlock').resolves();
      const batchImport = sandbox.stub(TransactionStorage, 'batchImport').resolves();
      await stop();
      await bitcoin.processBlock({} as any);
      await bitcoin.processTransaction({} as any);
      expect(addBlock.called).to.equal(false);
      expect(batchImport.called).to.equal(false);
    });

    function webhookTail(moralis: MoralisP2PWorker) {
      const tail = new EventEmitter() as any;
      tail.close = async () => {};
      sandbox.stub(WebhookStorage, 'getTail').returns(tail);
      sandbox.stub((moralis as any).csp, 'webhookToCoinEvents').returns([{}]);
      sandbox.stub(WebhookStorage, 'setProcessed').resolves();
      (moralis as any).syncAddressActivity();
      return tail;
    }

    it('a moralis worker resigns only once the webhook it is processing is written', async () => {
      const moralis = moralisWorker();
      await becomeSyncingNode(moralis);
      const tail = webhookTail(moralis);
      const signal = sandbox.stub(EventStorage, 'signalAddressCoin');
      const finish = stalledWrite(fn => {
        signal.callsFake(fn);
        tail.emit('data', { source: 'moralis' });
        return until(() => signal.called);
      });
      const stopping = stop();
      await until(() => pendingLoopTimers() > 0);
      await flush();
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
      await finish();
      await stopping;
      expect(await heartBeat()).to.equal(undefined);
    });

    it('a stopping moralis worker processes no more webhooks', async () => {
      const moralis = moralisWorker();
      await becomeSyncingNode(moralis);
      const tail = webhookTail(moralis);
      const signal = sandbox.stub(EventStorage, 'signalAddressCoin').resolves();
      await stop();
      tail.emit('data', { source: 'moralis' });
      await flush();
      expect(signal.called).to.equal(false);
    });

    it('a moralis worker resigns only once the block it is processing is written, and writes no more', async () => {
      const moralis = moralisWorker({ syncs: true });
      sandbox.stub(moralis, 'getWeb3').resolves({
        eth: {
          getBlockNumber: async () => 2,
          getBlock: async (height: number) => (height <= 2 ? { number: height, transactions: [] } : null)
        }
      } as any);
      sandbox.stub(moralis as any, 'syncAddressActivity').resolves();
      sandbox.stub(moralis as any, 'subscribeToAddressActivity').resolves(true);
      sandbox.stub(EVMBlockStorage, 'convertRawBlock').returns({} as any);
      const verified = sandbox.stub(StateStorage, 'setVerifiedBlockHeight').resolves();
      const signal = sandbox.stub(EventStorage, 'signalBlock');
      let finish;
      signal.onFirstCall().returns(new Promise(resolve => (finish = resolve)));
      signal.resolves();
      await becomeSyncingNode(moralis);
      await until(() => signal.called);
      const stopping = stop();
      await until(() => pendingLoopTimers() > 0);
      await flush();
      expect(await heartBeat()).to.equal(thisNode(start + PASS));
      finish();
      await stopping;
      expect(await heartBeat()).to.equal(undefined);
      await flush();
      expect(signal.callCount).to.equal(1);
      expect(verified.callCount).to.equal(1);
    });
  });

  describe('moralis writes', () => {
    it('syncs blocks and their transactions up to the tip', async () => {
      const moralis = moralisWorker({ syncs: true });
      sandbox.stub(moralis, 'getWeb3').resolves({
        eth: {
          getBlockNumber: async () => 1,
          getBlock: async (height: number) => (height <= 1 ? { number: height, transactions: [{}] } : null)
        }
      } as any);
      sandbox.stub(moralis as any, 'syncAddressActivity').resolves();
      sandbox.stub(moralis as any, 'subscribeToAddressActivity').resolves(true);
      sandbox.stub(EVMBlockStorage, 'convertRawBlock').returns({} as any);
      sandbox.stub(EVMTransactionStorage, 'convertRawTx').returns({} as any);
      const signalBlock = sandbox.stub(EventStorage, 'signalBlock').resolves();
      const signalTx = sandbox.stub(EventStorage, 'signalTx').resolves();
      const verified = sandbox.stub(StateStorage, 'setVerifiedBlockHeight').resolves();
      await drive(moralis).start();
      await driver.pass();
      await until(() => verified.callCount >= 2);
      await flush();
      expect(signalBlock.callCount).to.equal(2);
      expect(signalTx.callCount).to.equal(2);
      expect(verified.getCalls().map(call => call.args[0].height)).to.deep.equal([0, 1]);
    });

    it('marks a webhook processed once its events are signaled', async () => {
      const moralis = moralisWorker();
      const tail = new EventEmitter() as any;
      sandbox.stub(WebhookStorage, 'getTail').returns(tail);
      sandbox.stub((moralis as any).csp, 'webhookToCoinEvents').returns([{}, {}]);
      sandbox.stub(EventStorage, 'signalAddressCoin').onFirstCall().rejects(new Error('signal failed')).resolves();
      const setProcessed = sandbox.stub(WebhookStorage, 'setProcessed').resolves();
      (moralis as any).syncAddressActivity();
      const webhook = { source: 'moralis' };
      tail.emit('data', webhook);
      await until(() => setProcessed.called);
      expect(setProcessed.firstCall.args[0]).to.deep.equal({ webhook });
    });

    it('leaves a webhook unprocessed when none of its events are signaled', async () => {
      const moralis = moralisWorker();
      const tail = new EventEmitter() as any;
      sandbox.stub(WebhookStorage, 'getTail').returns(tail);
      sandbox.stub((moralis as any).csp, 'webhookToCoinEvents').returns([{}]);
      const signal = sandbox.stub(EventStorage, 'signalAddressCoin').rejects(new Error('signal failed'));
      const setProcessed = sandbox.stub(WebhookStorage, 'setProcessed').resolves();
      (moralis as any).syncAddressActivity();
      tail.emit('data', { source: 'moralis' });
      await until(() => signal.called);
      await flush();
      expect(setProcessed.called).to.equal(false);
    });
  });

  describe('P2pManager', () => {
    it('stops every worker even if one fails to stop', async () => {
      const manager = new P2pManager();
      const second = sandbox.stub().resolves();
      manager.workers = [{ stop: sandbox.stub().rejects(new Error('stop failed')) }, { stop: second }] as any;
      await manager.stop();
      expect(second.called).to.equal(true);
      expect(manager.workers).to.deep.equal([]);
    });

    it('logs the workers that fail to stop', async () => {
      const manager = new P2pManager();
      const failure = new Error('stop failed');
      manager.workers = [{ stop: sandbox.stub().rejects(failure) }] as any;
      const error = sandbox.spy(logger, 'error');
      await manager.stop();
      expect(error.getCalls().some(call => call.args.includes(failure))).to.equal(true);
    });

    it('stops its workers in parallel', async () => {
      const manager = new P2pManager();
      const stopped: string[] = [];
      manager.workers = [
        { stop: () => new Promise(() => {}) },
        { stop: async () => stopped.push('second') }
      ] as any;
      manager.stop();
      await flush();
      expect(stopped).to.deep.equal(['second']);
    });
  });

  describe('competing workers', () => {
    it('two workers starting together against an empty state elect one', async () => {
      const a = new TestWorker();
      const b = new TestWorker();
      await drive(a).start();
      const other = driveOther(b);
      await other.start();
      for (let i = 0; i < 2 * FIVE_MINUTES / PASS; i++) {
        await passAll(driver, other);
        expect(a.isSyncingNode && b.isSyncingNode).to.equal(false);
        expect((await admits(a)) && (await admits(b))).to.equal(false);
      }
      expect([a.isSyncingNode, b.isSyncingNode].filter(Boolean).length).to.equal(1);
      expect(a.syncs + b.syncs).to.equal(1);
    });

    it('a standby takes over from a syncing node whose renewals fail, with no time when both write', async () => {
      const a = new TestWorker();
      const b = new TestWorker();
      await drive(a).start();
      await driver.pass();
      expect(a.isSyncingNode).to.equal(true);
      const other = driveOther(b);
      await other.start();
      const nominate = StateStorage.selfNominateSyncingNode.bind(StateStorage);
      nominations.restore();
      const stub = sandbox.stub(StateStorage, 'selfNominateSyncingNode').callsFake(async (params: any) => {
        if (params.heartBeat?.endsWith(`:${(a as any).instanceId}`)) {
          throw new Error('renewal failed');
        }
        return nominate(params);
      });
      driver.nominations = stub;
      other.nominations = stub;
      let aStopped;
      let bStarted;
      for (let i = 0; i < 2 * FIVE_MINUTES / PASS; i++) {
        await passAll(driver, other);
        const aWrites = await admits(a);
        const bWrites = await admits(b);
        expect(aWrites && bWrites).to.equal(false);
        if (!aWrites && aStopped === undefined) {
          aStopped = i;
        }
        if (bWrites && bStarted === undefined) {
          bStarted = i;
        }
      }
      expect(leaseLost.calledOn(a)).to.equal(true);
      expect(b.isSyncingNode).to.equal(true);
      // at least the minute between the lease and the takeover
      expect((bStarted - aStopped) * PASS).to.be.at.least(60000);
    });
  });

  describe('workers that stop while another node holds a stale heartbeat', () => {
    const workers = [['bitcoin', bitcoinWorker], ['moralis', moralisWorker], ['base', () => new TestWorker()]] as const;
    for (const [name, make] of workers) {
      it(`a stopped ${name} worker never takes over`, async () => {
        await setHeartBeat(otherNode(start - 60000));
        await drive(make()).start();
        await driver.passUntil(start + 60000);
        await driver.stop();
        clock.tick(2 * FIVE_MINUTES);
        await driver.settle();
        expect(await heartBeat()).to.equal(otherNode(start - 60000));
      });
    }
  });

  describe('cost per pass', () => {
    it('leaves no timers pending while another node holds the heartbeat', async () => {
      await setHeartBeat(otherNode(start));
      await drive().start();
      let most = 0;
      while (Date.now() < start + 2 * FIVE_MINUTES) {
        await driver.pass();
        await setHeartBeat(otherNode(Date.now()));
        most = Math.max(most, pendingLoopTimers());
      }
      expect(most).to.equal(0);
    });

    it('leaves no timers pending as the syncing node', async () => {
      await drive().start();
      let most = 0;
      while (Date.now() < start + 2 * FIVE_MINUTES) {
        await driver.pass();
        most = Math.max(most, pendingLoopTimers());
      }
      expect(worker.isSyncingNode).to.equal(true);
      expect(most).to.equal(0);
    });

    it('does not write the state document while another node holds the heartbeat', async () => {
      await setHeartBeat(otherNode(start));
      await drive().start();
      const writesBefore = calls(WRITES);
      while (Date.now() < start + 2 * FIVE_MINUTES) {
        await driver.pass();
        await setHeartBeat(otherNode(Date.now()));
      }
      expect(calls(WRITES) - writesBefore).to.equal(0);
    });

    // a renewal is a single compare-and-set
    it('reads the state document once per pass as the syncing node', async () => {
      await drive().start();
      await driver.pass();
      const readsBefore = calls(['findOne']);
      for (let i = 0; i < 100; i++) {
        await driver.pass();
      }
      expect(calls(['findOne']) - readsBefore).to.equal(100);
    });

    it('writes the state document once per pass as the syncing node', async () => {
      await drive().start();
      await driver.pass();
      const writesBefore = calls(WRITES);
      for (let i = 0; i < 100; i++) {
        await driver.pass();
      }
      expect(calls(WRITES) - writesBefore).to.equal(100);
    });
  });
});
