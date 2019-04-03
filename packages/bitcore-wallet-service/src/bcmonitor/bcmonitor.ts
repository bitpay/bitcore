#!/usr/bin/env node
import _ from 'lodash';
import { BlockchainMonitor } from '../lib/blockchainmonitor';

const config = require('../config');
const log = require('npmlog');
log.debug = log.verbose;

const bcm = new BlockchainMonitor();
bcm.start(config, (err) => {
  if (err) throw err;

  console.log('Blockchain monitor started');
});
