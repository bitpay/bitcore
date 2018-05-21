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
  // TODO: this waits until all p2p services are synced,
  // this is probably not right.
  await Promise.all(p2pServices.map(w => w()));
};

const startAPI = async () => {
  const server = app.listen(config.port, function() {
    logger.info(`API server started on port ${config.port}`);
  });
  // TODO this should be config driven
  server.timeout = 600000;
};

const runMaster = async() => {
  await startServices();
  // start the API on master if we are in debug
  if(args.DEBUG){
    startAPI();
  }
};

const runWorker = async() => {
  // don't run any workers when in debug mode
  if(!args.DEBUG){
    await startServices();
    startAPI();
  }
}

const start = async() => {
  if(cluster.isMaster){
    await runMaster();
  } else{
    await runWorker();
  }
}

start();
