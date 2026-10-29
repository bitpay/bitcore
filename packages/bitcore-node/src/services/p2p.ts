import { randomBytes } from 'crypto';
import * as os from 'os';
import { ObjectID } from 'mongodb';
import logger from '../logger';
import { BaseBlock } from '../models/baseBlock';
import { StateStorage } from '../models/state';
import { IBlock } from '../types/Block';
import { Class } from '../types/Class';
import { wait } from '../utils';
import { Config, ConfigService } from './config';

// A standby takes over a heartbeat that has not changed for TAKEOVER_MS. The syncing node gives it up LEASE_MS after it
// started the last renewal it read back, which leaves it time to shut down (forced after 30 seconds) before anyone takes
// over. Both count elapsed time on the monotonic clock, so a step in the wall clock moves neither.
const TAKEOVER_MS = 5 * 60 * 1000;
const LEASE_MS = 4 * 60 * 1000;
// how long stop() waits for the worker's writes to finish and to resign before it leaves the heartbeat to expire
const STOP_WAIT_MS = 15000;

// resolves to fallback if promise has not settled within ms
export async function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer;
  const timeout = new Promise<T>(resolve => (timer = setTimeout(() => resolve(fallback), ms)));
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class P2pManager {
  workerClasses: { [chain: string]: Class<BaseP2PWorker> } = {};

  private configService: ConfigService;
  public workers: Array<BaseP2PWorker>;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.workers = new Array<BaseP2PWorker>();
  }

  register(chain: string, network: string, worker: Class<BaseP2PWorker<any>>) {
    this.workerClasses[chain] = this.workerClasses[chain] || {};
    this.workerClasses[chain][network] = worker;
  }

  get(chain: string, network: string) {
    return this.workerClasses[chain][network];
  }

  async stop() {
    logger.info('Stopping P2P Manager');
    // in parallel, so a worker that is slow or fails to stop doesn't hold up the others resigning
    const stopped = await Promise.allSettled(this.workers.map(worker => worker.stop()));
    for (const result of stopped) {
      if (result.status === 'rejected') {
        logger.error('Error stopping a P2P worker: %o', result.reason);
      }
    }
    this.workers = [];
  }

  async start() {
    if (this.configService.isDisabled('p2p')) {
      logger.info('Disabled P2P Manager');
      return;
    }
    logger.info('Starting P2P Manager');

    for (const chainNetwork of Config.chainNetworks()) {
      const { chain, network } = chainNetwork;
      const chainConfig = Config.chainConfig(chainNetwork);
      if ((chainConfig.chainSource && chainConfig.chainSource !== 'p2p') || chainConfig.disabled) {
        continue;
      }
      logger.info(`Starting P2P worker ${chain}:${network}`);
      const p2pWorker = new this.workerClasses[chain][network]({
        chain,
        network,
        chainConfig
      });
      this.workers.push(p2pWorker);
      try {
        p2pWorker.start();
      } catch (e: any) {
        logger.error('P2P Worker %o:%o died: %o', chain, network, e.stack || e.message || e);
      }
    }
  }
}

export class BaseP2PWorker<T extends IBlock = IBlock> {
  protected lastHeartBeat = '';
  // tells this worker's heartbeats apart from any other worker's, in this process or another
  protected readonly instanceId = randomBytes(6).toString('hex');
  // The heartbeats this worker has written since the last one it read back, with when it started writing each on the
  // monotonic clock, and that last one, which its lease runs from. A renewal that misses can be followed by one that
  // lands, so the heartbeat read back isn't always the latest written.
  private written = new Map<string, number>();
  private confirmed?: string;
  // when the lease from the last heartbeat this worker read back runs out, on the monotonic clock
  private leaseEnd = -Infinity;
  protected renewal?: Promise<void>;
  protected writes = new Set<Promise<unknown>>();
  // whether this worker runs the election, so that its writes need the lease
  protected electing = false;
  // the state document holding the heartbeat, as last read
  protected stateId?: ObjectID;
  protected stopping = false;
  protected chain = '';
  protected network = '';
  public isSyncingNode = false;
  // one SIGTERM per process: a second makes the worker processes exit at once
  private static leaseLossSignalled = false;

  constructor(protected params: { chain; network; chainConfig; blockModel?: BaseBlock<T> }) {}
  async start(): Promise<any> {}
  async stop(): Promise<any> {}
  async sync(): Promise<any> {}

  getIsSyncingNode(): boolean {
    return !!this.lastHeartBeat && this.lastHeartBeat === this.confirmed && performance.now() < this.leaseEnd;
  }

  // a read showing a heartbeat this worker wrote confirms it, and the lease now runs from when it was written
  private noteRead(heartBeat: string) {
    const startedAt = heartBeat ? this.written.get(heartBeat) : undefined;
    if (startedAt === undefined) {
      return;
    }
    this.confirmed = heartBeat;
    this.leaseEnd = startedAt + LEASE_MS;
    // an older heartbeat can't be read back once a newer one has
    for (const [written, writtenAt] of this.written) {
      if (writtenAt <= startedAt) {
        this.written.delete(written);
      }
    }
  }

  async waitTilSync() {
    while (true) {
      if (this.isSyncingNode) {
        return;
      }
      await wait(500);
    }
  }

  async refreshSyncingNode() {
    this.electing = true;
    // the other node's heartbeat this worker is waiting on, and when to take over if it is not renewed
    let takeover: { heartBeat: string; at: number } | undefined;
    // the node this worker last logged as holding the heartbeat
    let loggedHolder: string | undefined;
    while (!this.stopping) {
      const wasSyncingNode = this.isSyncingNode;
      this.lastHeartBeat = await this.readHeartBeat(wasSyncingNode);
      if (this.stopping) {
        break;
      }
      this.noteRead(this.lastHeartBeat);
      const nowSyncingNode = this.getIsSyncingNode();
      this.isSyncingNode = nowSyncingNode;
      if (wasSyncingNode && !nowSyncingNode) {
        logger.error(`Lost the ${this.chain} ${this.network} syncing node lease`);
        this.onLeaseLost();
        return;
      }
      if (!wasSyncingNode && nowSyncingNode) {
        logger.info(`This worker is now the syncing node for ${this.chain} ${this.network}`);
        this.sync();
      }
      if (!this.lastHeartBeat || this.getIsSyncingNode()) {
        loggedHolder = undefined;
        this.registerSyncingNode();
      } else {
        // the heartbeat without its time
        const holder = this.lastHeartBeat.split(':').filter((_, i) => i !== 2).join(':');
        if (holder !== loggedHolder) {
          logger.info(`${holder} is the syncing node for ${this.chain} ${this.network}`);
          loggedHolder = holder;
        }
        if (takeover?.heartBeat !== this.lastHeartBeat) {
          takeover = { heartBeat: this.lastHeartBeat, at: performance.now() + TAKEOVER_MS };
        }
        if (performance.now() >= takeover.at) {
          this.registerSyncingNode();
        }
      }
      await wait(500);
    }
  }

  // The worker processes stop gracefully on SIGTERM, which ends this worker's writes still in flight before a standby
  // can take over.
  protected onLeaseLost() {
    if (!BaseP2PWorker.leaseLossSignalled) {
      BaseP2PWorker.leaseLossSignalled = true;
      process.kill(process.pid, 'SIGTERM');
    }
  }

  // A read that fails or doesn't come back before the syncing node's lease ends keeps the last heartbeat read, which
  // the lease has then outlived.
  async readHeartBeat(wasSyncingNode: boolean): Promise<string> {
    const lastHeartBeat = this.lastHeartBeat;
    const read = () =>
      StateStorage.findSyncingNode({ chain: this.chain, network: this.network }).then(
        found => {
          this.stateId = found.stateId;
          return found.heartBeat;
        },
        err => {
          logger.error('Error reading the syncing node heartbeat: %o', err);
          return lastHeartBeat;
        }
      );
    if (!wasSyncingNode) {
      return read();
    }
    const leaseLeft = this.leaseEnd - performance.now();
    return leaseLeft > 0 ? within(read(), leaseLeft, lastHeartBeat) : lastHeartBeat;
  }

  // one nomination at a time, not awaited: the loop keeps reading, so a stalled renewal still lets the heartbeat expire
  registerSyncingNode() {
    if (!this.renewal) {
      const heartBeat = `${os.hostname()}:${process.pid}:${Date.now()}:${this.instanceId}`;
      const startedAt = performance.now();
      // one written longer ago than a lease could only be read back after the lease it would give has run out
      for (const [written, writtenAt] of this.written) {
        if (writtenAt + LEASE_MS <= startedAt) {
          this.written.delete(written);
        }
      }
      this.written.set(heartBeat, startedAt);
      this.renewal = StateStorage.selfNominateSyncingNode({
        chain: this.chain,
        network: this.network,
        lastHeartBeat: this.lastHeartBeat,
        heartBeat,
        stateId: this.stateId
      })
        .catch(err => logger.error('Error in selfNominateSyncingNode:', err))
        .then(() => {
          this.renewal = undefined;
        });
    }
  }

  // Whether the worker may write: not once it is stopping, and if it runs the election, only while it holds a lease it
  // has read back, checked against the time rather than waiting for the loop to notice the lease ran out.
  protected canWrite(): boolean {
    return !this.stopping && (!this.electing || (this.isSyncingNode && performance.now() < this.leaseEnd));
  }

  // Runs a sync write if the worker may write. A standby claims a resigned heartbeat on its next pass, so
  // unregisterSyncingNode resigns only once these finish.
  protected async write<R>(fn: () => Promise<R>): Promise<R | undefined> {
    if (!this.canWrite()) {
      return undefined;
    }
    const writing = fn();
    this.writes.add(writing);
    try {
      return await writing;
    } finally {
      this.writes.delete(writing);
    }
  }

  // Resigns once the writes and renewal in flight have finished, all within one deadline: past it, the heartbeat is
  // left to expire rather than hold up stop().
  async unregisterSyncingNode() {
    await wait(1000);
    const deadline = performance.now() + STOP_WAIT_MS;
    const drained = Promise.allSettled([this.renewal, ...this.writes]).then(() => true);
    if (!(await within(drained, deadline - performance.now(), false))) {
      logger.warn(`Leaving the ${this.chain} ${this.network} syncing node heartbeat to expire: writes still in flight`);
      return;
    }
    if (!(await within(this.resign().then(() => true), deadline - performance.now(), false))) {
      logger.warn(`Leaving the ${this.chain} ${this.network} syncing node heartbeat to expire: the resign did not finish`);
    }
  }

  // Once the writes have drained, nothing of this worker's can still be writing, so its own heartbeat can go even if the
  // lease has run out, and a restarted process needn't wait out the takeover.
  private async resign() {
    try {
      const found = await StateStorage.findSyncingNode({ chain: this.chain, network: this.network });
      this.lastHeartBeat = found.heartBeat;
      if (this.lastHeartBeat && (this.lastHeartBeat === this.confirmed || this.written.has(this.lastHeartBeat))) {
        await StateStorage.selfResignSyncingNode({
          chain: this.chain,
          network: this.network,
          lastHeartBeat: this.lastHeartBeat,
          stateId: found.stateId
        });
      }
    } catch (e: any) {
      logger.warn('Issue unregistering');
      logger.error('%o', e);
    }
  }
}

export const P2P = new P2pManager();
