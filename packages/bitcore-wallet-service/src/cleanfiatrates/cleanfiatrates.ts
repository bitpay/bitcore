#!/usr/bin/env node

process.env.LOGGER_IDENTIFIER = 'cleanfiatrates';

import { CleanFiatRates } from '../lib/cleanfiatrates';

const cleanFiatRatesScript = new CleanFiatRates();
cleanFiatRatesScript.run(err => {
  if (err) throw err;
  console.log('Clean fiat rates script finished');
});
