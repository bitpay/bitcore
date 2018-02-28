const async = require('async');
const cluster = require('cluster');

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({limit: 100000000}));

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
        let p2pServiceConfig = Object.assign(config.chains[chain][network], {chain,network});
        p2pServices.push(new p2pService(p2pServiceConfig));
      }
    }
    await Promise.all(p2pServices.map(p2pService => p2pService.start()));
  }
], function () {
  if (cluster.isWorker) {
    const router = require('./lib/routes');
    app.use('/api', router);
    const server = app.listen(config.port, function () {
      console.log('api server listening on port 3000!');
    });
    server.timeout = 600000;
  }
});

