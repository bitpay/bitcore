#!/usr/bin/env node
import _ from 'lodash';
import logger from '../lib/logger';
import config from '../config';
import { BlockchainMonitor } from '../lib/blockchainmonitor';

const bcm = new BlockchainMonitor();
bcm.start(config, err => {
  if (err) throw err;

  logger.info('Blockchain monitor started');
});
