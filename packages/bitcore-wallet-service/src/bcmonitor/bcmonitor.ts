#!/usr/bin/env node
import _ from 'lodash';
import config from '../config';
import { BlockchainMonitor } from '../lib/blockchainmonitor';
import logger from '../lib/logger';

const bcm = new BlockchainMonitor();
bcm.start(config, err => {
  if (err) throw err;

  logger.info('Blockchain monitor started');
});
