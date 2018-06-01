import { P2pService } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import { Api } from './services/api';
import config from './config';
import cluster = require('cluster');
import parseArgv from './utils/parseArgv';

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
      if (!hasChainSource || chainConfig.chainSource === 'p2p') {
        let p2pServiceConfig = Object.assign(config.chains[chain][network], {
          chain,
          network
        });
        p2pServices.push(new P2pService(p2pServiceConfig));
      }
    }
  }
  await Promise.all(p2pServices.map(p2pService => p2pService.start()));
};

if (cluster.isMaster) {
  startServices();
  if (args.DEBUG) {
    Api.start();
  }
} else {
  if (!args.DEBUG) {
    Api.start();
  }
}
