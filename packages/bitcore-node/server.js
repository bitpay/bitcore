const async = require('async');
const cluster = require('cluster');

const logger = require('./lib/logger');
const config = require('./lib/config');
const storageService = require('./lib/services/storage');
const workerService = require('./lib/services/worker');
const p2pService = require('./lib/services/p2p');

async.series([
  storageService.start.bind(storageService),
  workerService.start.bind(workerService),
  async () => {
    let p2pServices = [];
    for (let chain of Object.keys(config.chains)){
      for (let network of Object.keys(config.chains[chain])){
        const chainConfig = config.chains[chain][network];
        const hasChainSource = chainConfig.chainSource !== undefined;
        if(!hasChainSource || chainConfig.chainSource === 'p2p') {
          let p2pServiceConfig = Object.assign(config.chains[chain][network], {chain,network});
          p2pServices.push(new p2pService(p2pServiceConfig));
        }
      }
    }
    await Promise.all(p2pServices.map(p2pService => p2pService.start()));
  }
], function () {
  if (cluster.isWorker) {
    const app = require('./lib/routes');
    const server = app.listen(config.port, function () {
      logger.info(`API server started on port ${config.port}`);
    });
    server.timeout = 600000;
  }
});
