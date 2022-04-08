#!/usr/bin/env node

import logger from '../lib/logger';
const config = require('../config');

import { CurrencyRateService } from '../lib/currencyrate';

const service = new CurrencyRateService();
service.init(config, err => {
  if (err) throw err;
  service.startCron(config, err => {
    if (err) throw err;

    logger.info('Fiat rate service started');
  });
});
