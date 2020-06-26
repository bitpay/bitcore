#!/usr/bin/env node
import _ from 'lodash';
import { BlockchainMonitor } from '../lib/blockchainmonitor';
import logger from '../lib/logger';

const config = require('../config');
const bcm = new BlockchainMonitor();
bcm.start(config, err => {
  if (err) throw err;

  logger.info('Blockchain monitor started');
});
