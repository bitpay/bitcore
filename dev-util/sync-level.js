#!/usr/bin/env node 
'use strict';

var Sync        = require('../lib/Sync').class();


var s = new Sync();


s.setOrphan(
  '0000000000c2b1e8dab92a72741289e5ef0d4f375fd1b26f729da2ba979c028a',
  '000000000228f9d02654459e09998c7557afa9082784c11226853f5feb805df9',
  function (err) {
    console.log('[sync-level.js.15]',err); //TODO
  });


