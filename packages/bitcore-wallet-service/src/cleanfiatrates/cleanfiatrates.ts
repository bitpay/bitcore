#!/usr/bin/env node

import { CleanFiatRates } from '../lib/cleanfiatrates';

const cleanFiatRatesScript = new CleanFiatRates();
cleanFiatRatesScript.run(err => {
  if (err) throw err;
  console.log('Clean fiat rates script finished');
});
