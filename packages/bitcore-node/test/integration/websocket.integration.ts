import { resetDatabase } from '../helpers';
import { AsyncRPC } from '../../src/rpc';
import { BlockStorage } from '../../src/models/block';
import { expect } from 'chai';
import io = require('socket.io-client');
import config from '../../src/config';
import { P2pWorker } from '../../src/services/p2p';

const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);
console.log('Attempting socket connection');

describe('Websockets', () => {
  const socket = io.connect(
    'http://localhost:3000',
    { transports: ['websocket'] }
  );

  beforeEach(async () => {
    await resetDatabase();
  });

  it.only('should get a new block when one is generated', async () => {
    const p2pWorker = new P2pWorker({
      chain,
      network,
      chainConfig
    });

    await rpc.generate(1);
    await p2pWorker.start();
    await p2pWorker.sync();

    const tip = await BlockStorage.getLocalTip({ chain, network });
    expect(tip).to.not.eq(null);

    socket.on('connect', () => {
      console.log('Connected to socket');
      socket.emit('room', '/BTC/regtest/inv');
    });
    socket.on('block', payload => {
      console.log(payload);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    await rpc.generate(1);

    const afterGenTip = await BlockStorage.getLocalTip({ chain, network });

    if (tip != null && afterGenTip != null) {
      expect(tip.height).to.be.lt(afterGenTip.height);
    } else {
      console.log('no prevTip');
    }
  });
});
