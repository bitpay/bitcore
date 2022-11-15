#!/usr/bin/env node

import logger from '../lib/logger';
const config = require('../config');

import { FiatRateService } from '../lib/fiatrateservice';

const service = new FiatRateService();
service.init(config, err => {
  if (err) throw err;
  service.startCron(config, err => {
    if (err) throw err;

    logger.info('Fiat rate service started');
  });
});
