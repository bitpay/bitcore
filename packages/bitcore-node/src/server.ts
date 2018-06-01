import { P2pProvider } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import logger from './logger';
import config from './config';
import cluster = require('cluster');
import app from './routes';
import parseArgv from './utils/parseArgv';
let args = parseArgv([], ['DEBUG']);

const startServices = async () => {
  await Storage.start({});
  await Worker.start();
  await P2pProvider.startConfiguredChains();
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
