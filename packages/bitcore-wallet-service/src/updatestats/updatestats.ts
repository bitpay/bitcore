#!/usr/bin/env node

import { UpdateStats } from '../lib/updatestats';
var config = require('../config');


const script = new UpdateStats();
script.run(config, err => {
  if (err) throw err;
  console.log('Update stats script finished');
});