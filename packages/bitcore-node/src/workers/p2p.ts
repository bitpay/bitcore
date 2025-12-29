import cluster from 'cluster';
import 'source-map-support/register';
import fs from 'fs';
import logger from '../logger';
import { Modules } from '../modules';
import { Config } from '../services/config';
import { Event } from '../services/event';
import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import '../utils/polyfills';

const services: Array<any> = [];

export const P2pWorker = async () => {
  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  fs.mkdirSync('pids', { recursive: true });
  fs.writeFileSync('pids/p2p.pid', String(process.pid));

  services.push(Storage, Event);

  const { CHAIN: chain, NETWORK: network } = process.env;
  Modules.loadConfigured({ chain, network }); // loads all if no chain and network specified

  // start a particular chain and network, or all of them
  if (chain && network) {
    const chainConfig = Config.chainConfig({ chain, network });
    const p2pClass = P2P.get(chain, network);
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
    } catch (e: any) {
      logger.error('P2P Worker died: %o', e.stack || e.message || e);
    }
  }
};

let stopping = false;
const stop = async () => {
  if (stopping) {
    logger.warn('Force stopping P2P Worker');
    process.exit(1);
  }
  stopping = true;

  fs.unlinkSync('pids/p2p.pid');
  
  setTimeout(() => {
    logger.warn('P2P Worker did not shut down gracefully after 30 seconds, exiting');
    process.exit(1);
  }, 30 * 1000).unref();


  logger.info(`Shutting down P2P pid ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }

  if (!cluster.isPrimary) {
    process.removeAllListeners();
  }
};

if (require.main === module) {
  P2pWorker();
}
