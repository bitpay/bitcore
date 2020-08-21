import { expect } from 'chai';
import sinon from 'sinon';
import io = require('socket.io-client');
import config from '../../src/config';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';
import { AsyncRPC } from '../../src/rpc';
import { Api } from '../../src/services/api';
import { Event } from '../../src/services/event';
import { resetDatabase } from '../helpers';
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
import { wait } from '../../src/utils/wait';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';

function getSocket() {
  const socket = io.connect('http://localhost:3000', { transports: ['websocket'] });
  return socket;
}

let p2pWorker: BitcoinP2PWorker;
let socket = getSocket();
const bwsPrivKey = new PrivateKey();
const bwsKey = bwsPrivKey.publicKey.toString('hex');
const authKey = new PrivateKey();
const pubKey = authKey.publicKey.toString('hex');
const address = '2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t';
const sandbox = sinon.createSandbox();

describe('Websockets', function() {
  const suite = this;
  this.timeout(60000);

  before(async () => {
    intBeforeHelper();
    sandbox.stub(Socket.serviceConfig, 'bwsKeys').value([bwsKey]);
    await resetDatabase();
    await Event.start();
    await Api.start();
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
  });

  after(async () => {
    await Event.stop();
    await Api.stop();
    await resetDatabase();
    await intAfterHelper(suite);
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
    console.log('Starting p2p worker');
    p2pWorker.start();
    if (p2pWorker.isSyncing) {
      console.log('Worker is syncing. Waiting til done');
      await p2pWorker.syncDone();
    }
    console.log('Waiting til p2p done');
    await p2pWorker.waitTilSync();
    console.log('P2P done');
  });

  afterEach(async () => {
    try {
      console.log('Stopping p2p worker');
      await p2pWorker.stop();
      console.log('Disconnecting socket');
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
    let sawEvents = new Promise(async resolve => {
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
      while (!hasSeenBlockEvent) {
        console.log('WAITING FOR BLOCK EVENT ON SOCKET');
        if (hasSeenTxEvent && hasSeenCoinEvent && hasSeenBlockEvent) {
          return resolve();
        }
        await wait(1000);
      }
    });
    console.log('Generating 100 blocks');
    await rpc.call('generatetoaddress', [101, anAddress]);
    await p2pWorker.syncDone();
    console.log('Sync done, generating new block');
    await rpc.call('generatetoaddress', [1, anAddress]);
    console.log('Sending bitcoin');
    await rpc.sendtoaddress(address, 0.1);
    await sawEvents;
    expect(hasSeenBlockEvent).to.equal(true);
    expect(hasSeenTxEvent).to.equal(true);
    expect(hasSeenCoinEvent).to.equal(true);
  });

  it('should get wallet events', async () => {
    const authClient = new Client({ apiUrl: 'http://localhost:3000/api', authKey });

    const payload = { method: 'socket', url: 'http://localhost:3000/api' };
    const authPayload = { pubKey, message: authClient.getMessage(payload), signature: authClient.sign(payload) };
    const chain = 'BTC';
    const network = 'regtest';
    const roomPrefix = `/${chain}/${network}/`;
    socket.emit('room', roomPrefix + 'wallet', authPayload);

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;
    let sawEvents = new Promise(async resolve => {
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

      while (!hasSeenTxEvent) {
        console.log('WAITING FOR TX EVENT ON SOCKET');
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          return resolve();
        }
        await wait(1000);
      }
    });

    await rpc.sendtoaddress(address, 0.1);
    await sawEvents;
    expect(hasSeenTxEvent).to.equal(true);
    expect(hasSeenCoinEvent).to.equal(true);
  });

  it('should get all wallet events', async () => {
    const authClient = new Client({ apiUrl: 'http://localhost:3000/api', authKey: bwsPrivKey });
    const payload = { method: 'socket', url: 'http://localhost:3000/api' };
    const authPayload = {
      pubKey: bwsKey,
      message: authClient.getMessage(payload),
      signature: authClient.sign(payload)
    };

    const chain = 'BTC';
    const network = 'regtest';
    const roomPrefix = `/${chain}/${network}/`;
    socket.emit('room', roomPrefix + 'wallets', authPayload);

    let hasSeenTxEvent = false;
    let hasSeenCoinEvent = false;
    let sawEvents = new Promise(async resolve => {
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

      while (!hasSeenTxEvent) {
        console.log('WAITING FOR Wallet-TX EVENT ON SOCKET');
        if (hasSeenTxEvent && hasSeenCoinEvent) {
          return resolve();
        }
        await wait(1000);
      }
    });

    await rpc.sendtoaddress(address, 0.1);
    await sawEvents;
    expect(hasSeenTxEvent).to.equal(true);
    expect(hasSeenCoinEvent).to.equal(true);

    sandbox.restore();
  });

  it('should get an error when the key does not match the bwsKey', async () => {
    const pubKey = authKey.publicKey.toString('hex');
    const wrongKey = new PrivateKey();
    const authClient = new Client({ apiUrl: 'http://localhost:3000/api', authKey: wrongKey });

    const payload = { method: 'socket', url: 'http://localhost:3000/api' };
    const authPayload = { pubKey, message: authClient.getMessage(payload), signature: authClient.sign(payload) };
    const chain = 'BTC';
    const network = 'regtest';
    const roomPrefix = `/${chain}/${network}/`;
    let failed = new Promise(resolve => {
      socket.on('failure', e => {
        expect(e.message).to.include('Authentication failed');
        resolve();
      });
    });
    socket.emit('room', roomPrefix + 'wallets', authPayload);

    await failed;
  });

  it('should get an error when the signature is invalid', async () => {
    const wrongKey = new PrivateKey();
    const authClient = new Client({ apiUrl: 'http://localhost:3000/api', authKey: wrongKey });

    const payload = { method: 'socket', url: 'http://localhost:3000/api' };
    const authPayload = { pubKey, message: authClient.getMessage(payload), signature: 'invalid' };
    const chain = 'BTC';
    const network = 'regtest';
    const roomPrefix = `/${chain}/${network}/`;
    let failed = new Promise(resolve => {
      socket.on('failure', e => {
        expect(e.message).to.include('Authentication failed');
        resolve();
      });
    });
    socket.emit('room', roomPrefix + 'wallet', authPayload);

    await failed;
  });
});
