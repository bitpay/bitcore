#!/usr/bin/env node
import _ from 'lodash';
import logger from '../lib/logger';
import { BlockchainMonitor } from '../lib/blockchainmonitor';

const config = require('../config');
const bcm = new BlockchainMonitor();
bcm.start(config, err => {
  if (err) throw err;

  logger.info('Blockchain monitor started');
});
