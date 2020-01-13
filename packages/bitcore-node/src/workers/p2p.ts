import 'source-map-support/register';
import logger from '../logger';
import { Modules } from '../modules';
import { Config } from '../services/config';
import { Event } from '../services/event';
import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import '../utils/polyfills';
require('heapdump');
const services: Array<any> = [];

export const P2pWorker = async () => {
  process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event);

  Modules.loadConfigured();

  // start a particular chain and network, or all of them
  const { CHAIN: chain, NETWORK: network } = process.env;
  if (chain && network) {
    const chainConfig = Config.chainConfig({ chain, network });
    const p2pClass = P2P.get(chain);
    const worker = new p2pClass({
      chain,
      network,
      chainConfig
    });
    services.push(worker);
  } else {
    services.push(P2P);
  }

  for (const service of services) {
    try {
      await service.start();
    } catch (e) {
      logger.error('P2P Worker died with', e);
    }
  }
};

const stop = async () => {
  console.log(`Shutting down ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }
  process.exit();
};

if (require.main === module) {
  P2pWorker();
}
