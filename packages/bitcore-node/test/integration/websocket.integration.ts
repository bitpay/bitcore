import sinon from 'sinon';
import { expect } from 'chai';
import { resetDatabase } from '../helpers';
import { AsyncRPC } from '../../src/rpc';
import io = require('socket.io-client');
import config from '../../src/config';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';
const { PrivateKey } = require('bitcore-lib');

const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);
import { Client } from 'bitcore-client';
import { WalletStorage } from '../../src/models/wallet';
import { WalletAddressStorage } from '../../src/models/walletAddress';
import { Socket } from '../../src/services/socket';

function getSocket() {
  const socket = io.connect(
    'http://localhost:3000',
    { transports: ['websocket'] }
  );
  return socket;
}

let p2pWorker: BitcoinP2PWorker;
let socket = getSocket();
const bwsPrivKey = new PrivateKey();
const bwsKey = bwsPrivKey.publicKey.toString('hex');
const sandbox = sinon.createSandbox();

describe('Websockets', function() {
  this.timeout(180000);

  before(async () => {
    sandbox.stub(Socket.serviceConfig, 'bwsKeys').value([bwsKey]);
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
    const connected = new Promise(r => {
      socket.on('connect', () => {
        console.log('Socket connected');
        r();
      });
    });
    await connected;
    p2pWorker = new BitcoinP2PWorker({
      chain,
      network,
      chainConfig
    });
    p2pWorker.start();
    if (p2pWorker.isSyncing) {
      await p2pWorker.syncDone();
    }
    await p2pWorker.waitTilSync();
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
    socket.emit('room', '/BTC/regtest/inv');
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

  it('should get wallet events', async () => {
    const authKey = new PrivateKey();
    const pubKey = authKey.publicKey.toString('hex');
    const authClient = new Client({ baseUrl: 'http://localhost:3000/api', authKey });

    const payload = { method: 'socket', url: 'http://localhost:3000/api' };
    const authPayload = { pubKey, message: authClient.getMessage(payload), signature: authClient.sign(payload) };
    const chain = 'BTC';
    const network = 'regtest';
    const roomPrefix = `/${chain}/${network}/`;
    const address = '2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t';
    socket.emit('room', roomPrefix + 'wallet', authPayload);

    const inserted = await WalletStorage.collection.insertOne({
      chain,
      network,
      name: 'WalletSocketTest',
      singleAddress: false,
      pubKey,
      path: ''
    });

    await WalletAddressStorage.collection.insertOne({
      address,
      chain,
      network,
      processed: true,
      wallet: inserted.insertedId
    });

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;
    let sawEvents = new Promise(resolve => {
      socket.on('tx', () => {
        hasSeenTxEvent = true;
        console.log('Transaction event received');
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
      socket.on('coin', () => {
        hasSeenCoinEvent = true;
        console.log('Coin event received');
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
    });

    await rpc.sendtoaddress(address, 0.1);
    await sawEvents;
    expect(hasSeenTxEvent).to.equal(true);
    expect(hasSeenCoinEvent).to.equal(true);
  });

  it('should get all wallet events', async () => {
    const authKey = bwsPrivKey;
    const authClient = new Client({ baseUrl: 'http://localhost:3000/api', authKey });
    const payload = { method: 'socket', url: 'http://localhost:3000/api' };
    const authPayload = {
      pubKey: bwsKey,
      message: authClient.getMessage(payload),
      signature: authClient.sign(payload)
    };

    const chain = 'BTC';
    const network = 'regtest';
    const roomPrefix = `/${chain}/${network}/`;
    const address = '2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t';
    socket.emit('room', roomPrefix + 'wallets', authPayload);

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;
    let sawEvents = new Promise(resolve => {
      socket.on('tx', () => {
        hasSeenTxEvent = true;
        console.log('Transaction event received');
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
      socket.on('coin', () => {
        hasSeenCoinEvent = true;
        console.log('Coin event received');
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          resolve();
        }
      });
    });

    await rpc.sendtoaddress(address, 0.1);
    await sawEvents;
    expect(hasSeenTxEvent).to.equal(true);
    expect(hasSeenCoinEvent).to.equal(true);

    sandbox.restore();
  });
});
