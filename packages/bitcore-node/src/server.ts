import { build as buildP2p, init as initP2p } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import logger from './logger';
import config from './config';
import cluster = require('cluster');
import app from './routes';
import parseArgv from './utils/parseArgv';
import { isChainSupported } from './types/SupportedChain';
import { BlockModel } from './models/block';
import { TransactionModel } from './models/transaction';
let args = parseArgv([], ['DEBUG']);

const startServices = async () => {
  await Storage.start({});
  await Worker.start();

  // TODO this needs to move to a static p2pService method
  const p2pServices: (() => Promise<void>)[] = [];
  for (let chain of Object.keys(config.chains)) {
    for (let network of Object.keys(config.chains[chain])) {
      const chainConfig = config.chains[chain][network];
      const hasChainSource = chainConfig.chainSource !== undefined;
      const isP2p = chainConfig.chainSource === 'p2p';

      if (isChainSupported(chain) && (!hasChainSource || isP2p)) {
        let p2pServiceConfig = Object.assign(
          config.chains[chain][network],
          { chain, network }
        );

        // build the correct service for the chain
        const service = buildP2p(chain, p2pServiceConfig);

        // get ready to start the service
        p2pServices.push(() => initP2p(
          { chain, network }, BlockModel, TransactionModel, service));
      }
    }
  }
  await Promise.all(p2pServices.map(w => w()));
};

const startAPI = async () => {
  const server = app.listen(config.port, function() {
    logger.info(`API server started on port ${config.port}`);
  });
  // TODO this should be config driven
  server.timeout = 600000;
};

if (cluster.isMaster) {
  startServices();
  if (args.DEBUG) {
    startAPI();
  }
} else {
  if (!args.DEBUG) {
    startAPI();
  }
}
