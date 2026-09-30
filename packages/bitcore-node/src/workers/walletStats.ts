import cluster from 'cluster';
import 'source-map-support/register';
import logger from '../logger';
import { Event } from '../services/event';
import { Storage } from '../services/storage';
import { WalletStats } from '../services/walletStats';
import '../utils/polyfills';

const services: Array<any> = [];

export const WalletStatsWorker = async () => {
  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event, WalletStats);
  for (const service of services) {
    await service.start();
  }
};

let stopping = false;
const stop = async () => {
  if (stopping) {
    logger.error('Force stopping Wallet Stats Worker');
    process.exit(1);
  }
  stopping = true;

  setTimeout(() => {
    logger.error('Wallet Stats Worker did not shut down gracefully after 30 seconds, exiting');
    process.exit(1);
  }, 30 * 1000).unref();


  logger.info(`Shutting down wallet stats ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }

  if (!cluster.isPrimary) {
    process.removeAllListeners();
  }
};

if (require.main === module) {
  WalletStatsWorker();
}
