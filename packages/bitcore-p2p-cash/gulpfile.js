'use strict';

var startGulp = require('@bcpros/bitcore-build');
Object.assign(exports, startGulp('p2p', {skipBrowser: true}))
