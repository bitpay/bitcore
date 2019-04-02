#!/usr/bin/env node

'use strict';

import * as _ from 'lodash';
import { BlockchainMonitor } from '../lib/blockchainmonitor';
var log = require('npmlog');
log.debug = log.verbose;

var config = require('../config');

var bcm = new BlockchainMonitor();
bcm.start(config, function(err) {
  if (err) throw err;

  console.log('Blockchain monitor started');
});
