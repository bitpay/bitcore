'use strict';

/*
 * Example for usage of browserify with soop
 *
 * The key parameter 'pack'
 * The supplied 'custom_prelude.js' file is needed for 
 * .load function of soop.
 */

var fs = require('fs');
var browserify = require('browserify');
var browserPack = require('browser-pack');
var opts = {};


var preludePath  = 'node_modules/soop/example/custom_prelude.js';

var pack = function (params) {
  params.raw = true;
  params.sourceMapPrefix = '//#';
  params.prelude=  fs.readFileSync(preludePath, 'utf8');
  params.preludePath= preludePath;
  return browserPack(params);
};

opts.pack = pack;
opts.debug = true;

var modules = [
  'Address',
  'Block',
  'Bloom',
  'Buffers.monkey',
  'Deserialize',
  'Gruntfile',
  'Number.monkey',
  'Opcode',
  'Peer',
  'PeerManager',
  'PrivateKey',
  'RpcClient',
  'SIN',
  'SINKey',
  'Script',
  'ScriptInterpreter',
  'Sign',
  'Transaction',
  'Wallet',
  'WalletKey',
  'config',
  'const',
  'networks',
  'bitcore',
];

var b = browserify(opts);
b.require('browserify-bignum/bignumber.js', {expose: 'bignum'} );
b.require('browserify-buffertools/buffertools.js', {expose:'buffertools'});
b.require('buffer', {expose: 'buffer'});
b.require('base58-native');
b.require('./Key.js', {expose: 'KeyModule'});
b.require('./util/log');
b.require('./util/util');
b.require('./util/EncodedData');
b.require('./util/VersionedData');
b.add('./browser/bignum_config.js');
b.require('./test/testdata.js', {expose: './testdata'});
b.transform('brfs');

b.require('./Connection', {expose: './Connection'});

modules.forEach(function(m) {
   b.require('./' + m + '.js' ,{expose:m} );
 });

var bopts = {
  transform: ['brfs']
  // detectGlobals: true,
  // insertGlobals: 'Buffer',
  // insertGlobalVars: {
  //   Buffer: function () {
  //     return 'require("buffer").Buffer';
  //   },
  // },
};

b.bundle(bopts).pipe(process.stdout);




