'use strict';

var startGulp = require('bitcore-build');
Object.assign(exports, startGulp('p2p', {skipBrowser: true}))
