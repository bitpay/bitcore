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
let anAddress;

function getSocket() {
  const socket = io.connect(
    'http://localhost:3000',
    { transports: ['websocket'] }
  );
  return socket;
}

let p2pWorker: P2pWorker;
let socket = getSocket();

describe('Websockets', function() {
  this.timeout(180000);

  before(async () => {
    await resetDatabase();
    await Event.start();
    await Api.start();
  });

  after(async () => {
    await Event.stop();
    await Api.stop();
  });

  beforeEach(async () => {
    socket = getSocket();
    socket.on('connect', () => {
      socket.emit('room', '/BTC/regtest/inv');
    });
    p2pWorker = new P2pWorker({
      chain,
      network,
      chainConfig
    });
    p2pWorker.start();
    await p2pWorker.syncDone();
  });

  afterEach(async () => {
    try {
      await p2pWorker.stop();
      await socket.disconnect();
    } catch (e) {
      console.log('Error stopping p2p worker');
    }
  });

  it('should get a new block when one is generated', async () => {
    anAddress = await rpc.getnewaddress('');
    await rpc.call('generatetoaddress', [5, anAddress]);
    await p2pWorker.syncDone();
    const beforeGenTip = await BlockStorage.getLocalTip({ chain, network });
    expect(beforeGenTip).to.not.eq(null);

    if (beforeGenTip && beforeGenTip.height && beforeGenTip.height < 100) {
      await rpc.call('generatetoaddress', [100, anAddress]);
    }
    await rpc.call('generatetoaddress', [1, anAddress]);
    await p2pWorker.syncDone();
    await wait(1000);
    const afterGenTip = await BlockStorage.getLocalTip({ chain, network });
    expect(afterGenTip).to.not.eq(null);

    if (beforeGenTip != null && afterGenTip != null) {
      expect(beforeGenTip.height).to.be.lt(afterGenTip.height);
    }
  });

  it('should get a websocket event when a block is added', async () => {
    let hasSeenABlockEvent = false;
    let sawEvents = new Promise(resolve => {
      socket.on('block', () => {
        hasSeenABlockEvent = true;
        console.log('Block event received');
        resolve();
      });
    });

    await rpc.call('generatetoaddress', [1, anAddress]);
    await sawEvents;
    expect(hasSeenABlockEvent).to.be.eq(true);
  });

  it('should get a mempool tx and coin when mempool event, senttoaddress, occurs', async () => {
    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;
    let sent: any;
    let sawEvents = new Promise(resolve => {
      socket.on('tx', () => {
        hasSeenTxEvent = true;
        console.log('Transaction event received', sent);
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
      socket.on('coin', () => {
        hasSeenCoinEvent = true;
        console.log('Coin event received', sent);
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
    });
    sent = await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await sawEvents;
    expect([hasSeenTxEvent, hasSeenCoinEvent]).to.deep.eq([true, true]);
  });

  it('should get a mempool event while syncing', async () => {
    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;
    let sent: any;
    let sawEvents = new Promise(resolve => {
      socket.on('tx', () => {
        hasSeenTxEvent = true;
        console.log('Transaction event received', sent);
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
      socket.on('coin', () => {
        hasSeenCoinEvent = true;
        console.log('Coin event received', sent);
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
    });
    p2pWorker.isSyncing = true;
    sent = await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await sawEvents;
    expect([hasSeenTxEvent, hasSeenCoinEvent]).to.deep.eq([true, true]);
  });
});
