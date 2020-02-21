#!/usr/bin/env node

var config = require('../config');

import { FiatRateService } from '../lib/fiatrateservice';

const service = new FiatRateService();
service.init(config, err => {
  if (err) throw err;
  service.startCron(config, err => {
    if (err) throw err;

    console.log('Fiat rate service started');
  });
});
