import { expect } from 'chai';
import { resetDatabase } from '../helpers';
import { AsyncRPC } from '../../src/rpc';
import io = require('socket.io-client');
import config from '../../src/config';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';

const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

function getSocket() {
  const socket = io.connect(
    'http://localhost:3000',
    { transports: ['websocket'] }
  );
  return socket;
}

let p2pWorker: BitcoinP2PWorker;
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
      console.log('Socket connected');
      socket.emit('room', '/BTC/regtest/inv');
    });
    p2pWorker = new BitcoinP2PWorker({
      chain,
      network,
      chainConfig
    });
    p2pWorker.start();
    if (p2pWorker.isSyncing) {
      await p2pWorker.syncDone();
    }
  });

  afterEach(async () => {
    try {
      await p2pWorker.stop();
      await socket.disconnect();
    } catch (e) {
      console.log('Error stopping p2p worker');
    }
  });

  it('should get websocket events', async () => {
    let hasSeenTxEvent = false;
    let hasSeenBlockEvent = false;
    let hasSeenCoinEvent = false;
    const anAddress = await rpc.getnewaddress('');
    let sawEvents = new Promise(resolve => {
      socket.on('block', () => {
        hasSeenBlockEvent = true;
        console.log('Block event received');
        if (hasSeenTxEvent && hasSeenCoinEvent && hasSeenBlockEvent) {
          resolve();
        }
      });
      socket.on('tx', () => {
        hasSeenTxEvent = true;
        console.log('Transaction event received');
        if (hasSeenTxEvent && hasSeenCoinEvent && hasSeenBlockEvent) {
          resolve();
        }
      });
      socket.on('coin', () => {
        hasSeenCoinEvent = true;
        console.log('Coin event received');
        if (hasSeenTxEvent && hasSeenCoinEvent && hasSeenBlockEvent) {
          resolve();
        }
      });
    });
    console.log('Generating 100 blocks');
    await rpc.call('generatetoaddress', [101, anAddress]);
    await p2pWorker.syncDone();
    console.log('Sync done, generating new block');
    await rpc.call('generatetoaddress', [1, anAddress]);
    console.log('Sending bitcoin');
    await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await sawEvents;
    expect(hasSeenBlockEvent).to.equal(true);
    expect(hasSeenTxEvent).to.equal(true);
    expect(hasSeenCoinEvent).to.equal(true);
  });
});
