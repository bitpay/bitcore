import { P2pService } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import { Api } from './services/api';
import cluster = require('cluster');
import parseArgv from './utils/parseArgv';
let args = parseArgv([], ['DEBUG']);

const startServices = async () => {
  await Storage.start({});
  await Worker.start();
  P2pService.startConfiguredChains();
};

const runMaster = async() => {
  await startServices();
  // start the API on master if we are in debug
  if(args.DEBUG){
    Api.start();
  }
};

const runWorker = async() => {
  // don't run any workers when in debug mode
  if(!args.DEBUG){
    // Api will automatically start storage if it isn't already running
    Api.start();
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
