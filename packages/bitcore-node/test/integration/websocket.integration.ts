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

describe('Websockets', function() {
  this.timeout(50000);
  before(async () => {
    await resetDatabase();
  });

  it('should get a new block when one is generated', async () => {
    const p2pWorker = new P2pWorker({
      chain,
      network,
      chainConfig
    });
    await rpc.generate(1);
    await p2pWorker.start();
    await p2pWorker.sync();

    const checkForBlocks = await BlockStorage.getLocalTip({chain, network});
    if (checkForBlocks === null || checkForBlocks.height < 100) {
      rpc.generate(100)
    }

    await rpc.generate(1);
    await p2pWorker.sync();
    await wait(1000);

    const afterGenTip = await BlockStorage.getLocalTip({ chain, network });
    expect(afterGenTip).to.not.eq(null);

    if (checkForBlocks != null && afterGenTip != null) {
      expect(checkForBlocks.height).to.be.lt(afterGenTip.height);
    }

    await p2pWorker.stop();
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
    socket.on('connect', () => {
      socket.emit('room', '/BTC/regtest/inv');
    });
    socket.on('block', () => {
      hasSeenABlockEvent = true;
    });

    await p2pWorker.start();
    await rpc.generate(1);
    await p2pWorker.sync();
    await wait(1000);
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

    socket.on('connect', () => {
      socket.emit('room', '/BTC/regtest/inv');
    });
    socket.on('tx', () => {
      hasSeenTxEvent = true;
    });
    socket.on('coin', () => {
      hasSeenCoinEvent = true;
    });
    await p2pWorker.start();
    await p2pWorker.sync();
    await wait(5000);
    await rpc.sendtoaddress('2MuYKLUaKCenkEpwPkWUwYpBoDBNA2dgY3t', 0.1);
    await wait(15000);

    await p2pWorker.stop();
    await socket.disconnect();

    expect([hasSeenTxEvent, hasSeenCoinEvent]).to.deep.eq([true, true]);
  });
});
