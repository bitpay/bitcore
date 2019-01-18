import { resetDatabase } from '../helpers';
import { AsyncRPC } from '../../src/rpc';
import { BlockStorage } from '../../src/models/block';
import { expect } from 'chai';
import io = require('socket.io-client');
import config from '../../src/config';
import { P2pWorker } from '../../src/services/p2p';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';

const wait = (time) => new Promise((resolve)=>setTimeout(resolve, time));

const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

describe('Websockets', () => {
  before(async () => {
    await resetDatabase();
  });

  it('should get a new block when one is generated', async () => {
    const p2pWorker = new P2pWorker({
      chain,
      network,
      chainConfig
    });

    await rpc.generate(5);
    await p2pWorker.start();
    await p2pWorker.sync();
    await rpc.generate(1);
    await p2pWorker.sync();

    const tip = await BlockStorage.getLocalTip({ chain, network });
    expect(tip).to.not.eq(null);

    await rpc.generate(1);
    await p2pWorker.sync();
    await wait(1000);

    const afterGenTip = await BlockStorage.getLocalTip({ chain, network });

    if (tip != null && afterGenTip != null) {
      expect(tip.height).to.be.lt(afterGenTip.height);
    } else {
      console.log('no prevTip');
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

    await rpc.generate(1);
    await p2pWorker.start();
    await p2pWorker.sync();
    await rpc.generate(1);
    await p2pWorker.sync();
    await wait(1000);

    let hasSeenABlockEvent = false;
    console.log('Attempting socket connection');
    const socket = io.connect(
      'http://localhost:3000',
      { transports: ['websocket'] }
    );
    socket.on('connect', () => {
      console.log('Connected to socket');
      socket.emit('room', '/BTC/regtest/inv');
    });
    socket.on('block', payload => {
      hasSeenABlockEvent = true;
      console.log(payload);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    await rpc.generate(1);
    await p2pWorker.sync();
    await wait(1000);
    await p2pWorker.stop();

    expect(hasSeenABlockEvent).to.be.eq(true);
  });
});
