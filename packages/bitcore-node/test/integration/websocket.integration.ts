import { resetDatabase } from '../helpers';
import { AsyncRPC } from '../../src/rpc';
import { BlockStorage } from '../../src/models/block';
import { expect } from 'chai';
import io = require('socket.io-client');
import config from '../../src/config';
import { P2pWorker } from '../../src/services/p2p';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';

const wait = time => new Promise(resolve => setTimeout(resolve, time));
const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

let p2pWorker: P2pWorker;

describe('Websockets', function() {
  this.timeout(50000);
  before(async () => {
    await resetDatabase();
  });

  beforeEach(() => {
    p2pWorker = new P2pWorker({
      chain,
      network,
      chainConfig
    });
  });

  afterEach(async () => {
    try {
      await p2pWorker.stop();
    } catch (e) {
      console.log('Error stopping p2p worker');
    }
  });

  it('should get a new block when one is generated', async () => {
    await p2pWorker.start();

    await rpc.generate(5);
    await p2pWorker.syncDone();
    const beforeGenTip = await BlockStorage.getLocalTip({ chain, network });
    expect(beforeGenTip).to.not.eq(null);

    if (beforeGenTip && beforeGenTip.height && beforeGenTip.height < 100) {
      await rpc.generate(100);
    }
    await rpc.generate(1);
    await p2pWorker.syncDone();
    await wait(1000);
    const afterGenTip = await BlockStorage.getLocalTip({ chain, network });
    expect(afterGenTip).to.not.eq(null);

    if (beforeGenTip != null && afterGenTip != null) {
      expect(beforeGenTip.height).to.be.lt(afterGenTip.height);
    }
  });

  it('should get a websocket event when a block is added', async () => {
    await Event.start();
    await Api.start();

    const p2pWorker = new P2pWorker({
      chain,
      network,
      chainConfig
    });

    let hasSeenABlockEvent = false;

    const socket = io.connect(
      'http://localhost:3000',
      { transports: ['websocket'] }
    );
    let sawEvents = new Promise(resolve => {
      socket.on('connect', () => {
        socket.emit('room', '/BTC/regtest/inv');
      });
      socket.on('block', () => {
        hasSeenABlockEvent = true;
        resolve();
      });
    });

    await p2pWorker.start();
    await rpc.generate(1);
    await sawEvents;
    await p2pWorker.stop();
    await socket.disconnect();

    expect(hasSeenABlockEvent).to.be.eq(true);
  });

  it('should get a mempool tx and coin when mempool event, senttoaddress, occurs', async () => {
    const p2pWorker = new P2pWorker({ chain, network, chainConfig });

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;

    const socket = io.connect(
      'http://localhost:3000',
      { transports: ['websocket'] }
    );

    let sawEvents = new Promise(resolve => {
      socket.on('connect', () => {
        socket.emit('room', '/BTC/regtest/inv');
      });
      socket.on('tx', () => {
        hasSeenTxEvent = true;
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
      socket.on('coin', () => {
        hasSeenCoinEvent = true;
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
    });
    await p2pWorker.start();
    await wait(3000);
    await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await sawEvents;

    await p2pWorker.stop();
    await socket.disconnect();

    expect([hasSeenTxEvent, hasSeenCoinEvent]).to.deep.eq([true, true]);
  });
});
