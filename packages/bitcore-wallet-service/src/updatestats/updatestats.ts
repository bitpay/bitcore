#!/usr/bin/env node

import { UpdateStats } from '../lib/updatestats';
var config = require('../config');

const updateStatsScript = new UpdateStats();
updateStatsScript.run(config, err => {
  if (err) throw err;
  console.log('Update stats script finished');
});
