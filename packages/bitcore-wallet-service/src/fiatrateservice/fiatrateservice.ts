#!/usr/bin/env node

'use strict';

var config = require('../config');
var FiatRateService = require('../lib/fiatrateservice');

var service = new FiatRateService();
service.init(config, function(err) {
  if (err) throw err;
  service.startCron(config, function(err) {
    if (err) throw err;

    console.log('Fiat rate service started');
  });
});
