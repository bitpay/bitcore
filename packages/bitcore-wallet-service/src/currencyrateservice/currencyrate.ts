#!/usr/bin/env node

process.env.LOGGER_IDENTIFIER = 'currencyrateservice';

import config from '../config'
import logger from '../lib/logger';
import { CurrencyRateService } from '../lib/currencyrate';

const service = new CurrencyRateService();
service.init(config, err => {
  if (err) throw err;
  service.startCron(config, err => {
    if (err) throw err;

    logger.info('Fiat rate service started');
  });
});
