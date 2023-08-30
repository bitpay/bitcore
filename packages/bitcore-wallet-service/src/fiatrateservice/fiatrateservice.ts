#!/usr/bin/env node

import config from '../config';
import { FiatRateService } from '../lib/fiatrateservice';
import logger from '../lib/logger';

const service = new FiatRateService();
service.init(config, err => {
  if (err) throw err;
  service.startCron(config, err => {
    if (err) throw err;

    logger.info('Fiat rate service started');
  });
});
