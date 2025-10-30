#!/usr/bin/env node

import config from '../config';
import { UpdateStats } from '../lib/updatestats';

const updateStatsScript = new UpdateStats();
updateStatsScript.run(config, err => {
  if (err) throw err;
  console.log('Update stats script finished');
});
