import { P2P } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import { Api } from './services/api';
import cluster = require('cluster');
import parseArgv from './utils/parseArgv';
import { Event } from './services/event';
let args = parseArgv([], ['DEBUG']);

process.on('unhandledRejection', error => {
  console.error('Unhandled Rejection at:', error.stack || error);
});

const startServices = async () => {
  await Worker.start();
  await P2P.start();
};

const runMaster = async () => {
  await startServices();
  // start the API on master if we are in debug
  if (args.DEBUG) {
    await Api.start();
  }
};

const runWorker = async () => {
  // don't run any workers when in debug mode
  if (!args.DEBUG) {
    // Api will automatically start storage if it isn't already running
    await Api.start();
  }
};

const start = async () => {
  await Storage.start({});
  await Event.start();
  if (cluster.isMaster) {
    await runMaster();
  } else {
    await runWorker();
  }
};

start();
