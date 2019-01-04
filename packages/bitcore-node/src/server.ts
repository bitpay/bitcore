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


const runMaster = async () => {
  await Worker.start();
  P2P.start();

  // start the API on master if we are in debug
  if (args.DEBUG) {
    Api.start();
  }
};

const runWorker = async () => {
  // don't run any workers when in debug mode
  if (!args.DEBUG) {
    // Api will automatically start storage if it isn't already running
    Api.start();
  }
};

const start = async () => {
  await Storage.start();
  Event.start();
  if (cluster.isMaster) {
    await runMaster();
  } else {
    await runWorker();
  }
};

start();
