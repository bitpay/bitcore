#!/usr/bin/env node

import { UpdateStats } from '../lib/updatestats';
var config = require('../config');


const service = new UpdateStats();
service.init(config, err => {
  if (err) throw err;
  console.log('Update stats service started');
});