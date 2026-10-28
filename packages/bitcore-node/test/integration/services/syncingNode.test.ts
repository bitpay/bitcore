import { AsyncLocalStorage } from 'async_hooks';
import { expect } from 'chai';
import { Collection } from 'mongodb';
import * as os from 'os';
import * as sinon from 'sinon';
import { BitcoinP2PWorker } from '../../../src/modules/bitcoin/p2p';
import { MoralisP2PWorker } from '../../../src/modules/moralis/p2p/p2p';
import { StateStorage } from '../../../src/models/state';
import { BaseEVMStateProvider } from '../../../src/providers/chain-state/evm/api/csp';
import { Libs } from '../../../src/providers/libs';
import { BaseP2PWorker } from '../../../src/services/p2p';
import { Storage } from '../../../src/services/storage';
import * as utils from '../../../src/utils';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

const chain = 'BTC';
const network = 'heartbeattest';
const key = `syncingNode:${chain}:${network}`;
const PASS = 500;
const FIVE_MINUTES = 5 * 60 * 1000;
const LEASE = 4 * 60 * 1000;
const RENEWAL_WAIT = 5000;
const otherNode = (time: number) => `otherhost:4242:${time}`;
const thisNode = (time: number) => `${os.hostname()}:${process.pid}:${time}`;
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
    clock = sandbox.useFakeTimers({ now: start, toFake: ['Date'] });
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

  // stops the worker while its next heartbeat read is pending
  function stopDuringNextRead() {
    const read = StateStorage.getSyncingNode.bind(StateStorage);
    let reads = 0;
    sandbox.stub(StateStorage, 'getSyncingNode').callsFake(async params => {
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
    const deadline = performance.now() + 5000;
    while (!condition()) {
      if (performance.now() > deadline) {
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
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined });
      expect(await heartBeat()).to.equal(thisNode(start));

      clock.tick(1000);
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: otherNode(start) });
      expect(await heartBeat()).to.equal(thisNode(start));

      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: thisNode(start) });
      expect(await heartBeat()).to.equal(thisNode(start + 1000));
      expect(await direct.countDocuments({})).to.equal(1);
    });

    it('selfNominateSyncingNode does not renew a heartbeat that has been removed', async () => {
      await setHeartBeat(thisNode(start - 1000));
      await direct.updateOne({}, { $unset: { [key]: true } });
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: thisNode(start - 1000) });
      expect(await heartBeat()).to.equal(undefined);
    });

    it('selfNominateSyncingNode claims a missing heartbeat when the previous one is empty', async () => {
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: '' });
      expect(await heartBeat()).to.equal(thisNode(start));
    });

    it('selfNominateSyncingNode without a previous heartbeat leaves another node\'s heartbeat', async () => {
      await setHeartBeat(otherNode(start));
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined });
      expect(await heartBeat()).to.equal(otherNode(start));
    });

    it('the heartbeat queries leave other chains\' heartbeats alone', async () => {
      const others = {
        [`syncingNode:${chain}:othernet`]: otherNode(start),
        [`syncingNode:BCH:${network}`]: otherNode(start)
      };
      await direct.insertOne({ ...others });
      expect(await StateStorage.getSyncingNode({ chain, network })).to.equal(undefined);
      await StateStorage.selfNominateSyncingNode({ chain, network, lastHeartBeat: undefined });
      expect(await heartBeat()).to.equal(thisNode(start));
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: thisNode(start) });
      const [state] = await direct.find({}).toArray();
      expect(state).to.not.have.property(key);
      for (const [otherKey, value] of Object.entries(others)) {
        expect(state).to.have.property(otherKey, value);
      }
    });

    it('selfResignSyncingNode removes only the heartbeat it was given', async () => {
      await setHeartBeat(otherNode(start));
      await StateStorage.selfResignSyncingNode({ chain, network, lastHeartBeat: thisNode(start) });
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

    it('fails when another node replaces its heartbeat', async () => {
      await drive().start();
      await driver.pass();
      expect(worker.isSyncingNode).to.equal(true);
      await setHeartBeat(otherNode(Date.now()));
      await driver.pass();
      let error;
      await driver.loop!.catch(e => (error = e));
      expect(error).to.be.an('error').with.property('message', 'Syncing Node Renewal Failure');
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
      expect(error).to.be.an('error').with.property('message', 'Syncing Node Renewal Failure');
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
        expect(await heartBeat()).to.equal(thisNode(Date.now()));
        await driver.pass();
        expect(testWorker.isSyncingNode).to.equal(false);
        expect(error).to.be.an('error').with.property('message', 'Syncing Node Renewal Failure');
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
      const read = StateStorage.getSyncingNode.bind(StateStorage);
      let unstall;
      const stalled = new Promise(resolve => (unstall = resolve));
      let reads = 0;
      sandbox.stub(StateStorage, 'getSyncingNode').callsFake(params => {
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
        expect(error).to.be.an('error').with.property('message', 'Syncing Node Renewal Failure');
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
      } finally {
        unstall();
      }
    });

    it('resigns after waiting five seconds on a renewal that has not settled, which cannot claim the heartbeat back', async () => {
      await drive().start();
      await driver.pass();
      const nominate = StateStorage.selfNominateSyncingNode.bind(StateStorage);
      let unstall;
      const stalled = new Promise(resolve => (unstall = resolve));
      nominations.restore();
      const stub = sandbox.stub(StateStorage, 'selfNominateSyncingNode').callsFake(async params => {
        await stalled;
        return nominate(params);
      });
      driver.nominations = sandbox.spy();
      try {
        await driver.pass();
        expect(stub.callCount).to.equal(1);
        let stopped = false;
        const stopping = loopContext.run(driver, () => worker.stop()).then(() => (stopped = true));
        await until(() => pendingLoopTimers() > 0);
        clock.tick(RENEWAL_WAIT - 1);
        await flush();
        expect(stopped).to.equal(false);
        clock.tick(1);
        await stopping;
        expect(await heartBeat()).to.equal(undefined);
        unstall();
        await Promise.all(stub.returnValues);
        expect(await heartBeat()).to.equal(undefined);
      } finally {
        unstall();
      }
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
      sandbox.stub(StateStorage, 'getSyncingNode').rejects(new Error('read failed'));
      await driver.stop();
      expect(await heartBeat()).to.match(new RegExp(`^${os.hostname()}:`));
    });
  });

  describe('workers that stop while another node holds a stale heartbeat', () => {
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

    function moralisWorker() {
      sandbox.stub(BaseEVMStateProvider, 'initializeRpcs');
      const moralis = new MoralisP2PWorker({ chain, network, chainConfig: {} });
      sandbox.stub(moralis, 'sync').resolves();
      return moralis;
    }

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
