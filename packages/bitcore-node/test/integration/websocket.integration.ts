import { resetDatabase } from '../helpers';
import { AsyncRPC } from '../../src/rpc';
import { BitcoinBlockStorage } from '../../src/models/block';
import { expect } from 'chai';
import io = require('socket.io-client');
import config from '../../src/config';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';

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

let p2pWorker: BitcoinP2PWorker;

describe('Websockets', function() {
  this.timeout(50000);
  before(async () => {
    await resetDatabase();
  });

  beforeEach(() => {
    p2pWorker = new BitcoinP2PWorker({
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

    anAddress = await rpc.getnewaddress('');
    await rpc.call('generatetoaddress', [5, anAddress]);
    await p2pWorker.syncDone();
    const beforeGenTip = await BitcoinBlockStorage.getLocalTip({ chain, network });
    expect(beforeGenTip).to.not.eq(null);

    if (beforeGenTip && beforeGenTip.height && beforeGenTip.height < 100) {
      await rpc.call('generatetoaddress', [100, anAddress]);
    }
    await rpc.call('generatetoaddress', [1, anAddress]);
    await p2pWorker.syncDone();
    await wait(1000);
    const afterGenTip = await BitcoinBlockStorage.getLocalTip({ chain, network });
    expect(afterGenTip).to.not.eq(null);

    if (beforeGenTip != null && afterGenTip != null) {
      expect(beforeGenTip.height).to.be.lt(afterGenTip.height);
    }
  });

  it('should get a websocket event when a block is added', async () => {
    await Event.start();
    await Api.start();

    p2pWorker = new BitcoinP2PWorker({
      chain,
      network,
      chainConfig
    });

    let hasSeenABlockEvent = false;

    const socket = getSocket();
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
    await rpc.call('generatetoaddress', [1, anAddress]);
    await sawEvents;
    await p2pWorker.stop();
    await socket.disconnect();

    expect(hasSeenABlockEvent).to.be.eq(true);
  });

  it('should get a mempool tx and coin when mempool event, senttoaddress, occurs', async () => {
    p2pWorker = new BitcoinP2PWorker({ chain, network, chainConfig });

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;

    const socket = getSocket();
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
    await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await sawEvents;

    await p2pWorker.stop();
    await socket.disconnect();

    expect([hasSeenTxEvent, hasSeenCoinEvent]).to.deep.eq([true, true]);
  });

  it('should get a mempool event while syncing', async () => {
    p2pWorker = new BitcoinP2PWorker({ chain, network, chainConfig });

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;

    const socket = getSocket();
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
    p2pWorker.sync();
    p2pWorker.isSyncing = true;
    await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await sawEvents;

    await p2pWorker.stop();
    await socket.disconnect();

    expect([hasSeenTxEvent, hasSeenCoinEvent]).to.deep.eq([true, true]);
  });
});
