import { P2pService, build } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import logger from './logger';
import config from './config';
import cluster = require('cluster');
import app from './routes';
import parseArgv from './utils/parseArgv';
import { isChainSupported } from './types/SupportedChain';
import { promisify } from 'util';
import { BlockModel } from './models/block';
let args = parseArgv([], ['DEBUG']);

const startServices = async () => {
  await Storage.start({});
  await Worker.start();

  // TODO this needs to move to a static p2pService method
  let p2pServices = [] as Array<P2pService>;
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
        const service = build(chain, {
          getLocalTip: promisify(BlockModel.getLocalTip.bind(BlockModel)),
          getLocatorHashes: promisify(BlockModel.getLocatorHashes.bind(BlockModel)),
          handleReorg: promisify(BlockModel.handleReorg.bind(BlockModel)),
        }, p2pServiceConfig);

        // attach it to the database
        // TODO

        p2pServices.push(service);
      }
    }
  }
  await Promise.all(p2pServices.map(p2pService => p2pService.start()));
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
