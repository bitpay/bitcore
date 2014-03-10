'use strict';

/*
 *
 * The key parameter 'pack'
 * The supplied 'custom_prelude.js' file is needed for 
 * .load function of soop.
 */

var fs = require('fs');
var browserify = require('browserify');
var browserPack = require('browser-pack');


var pack = function (params) {
  var preludePath  = 'node_modules/soop/example/custom_prelude.js';
  params.raw = true;
  params.sourceMapPrefix = '//#';
  params.prelude = fs.readFileSync(preludePath, 'utf8');
  params.preludePath = preludePath;
  return browserPack(params);
};

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
];

var opts = {};
//opts.pack = pack;
opts.debug = true;
opts.standalone = 'bitcore';
opts.insertGlobals = true;

var b = browserify(opts);
b.require('browserify-bignum/bignumber.js', {expose: 'bignum'} );
b.require('browserify-buffertools/buffertools.js', {expose:'buffertools'});
b.require('./bitcore', {expose: 'bitcore'});
b.require('buffer', {expose: 'buffer'});
b.require('base58-native');
b.require('./Key.js', {expose: 'KeyModule'});
b.require('./util/log');
b.require('./util/util');
b.require('./util/EncodedData');
b.require('./util/VersionedData');
b.add('./browser/bignum_config.js');

modules.forEach(function(m) {
   b.require('./' + m + '.js' ,{expose: './'+m} );
});
b.require('soop');

b.bundle().pipe(fs.createWriteStream('browser/bundle.js'));


opts.standalone = 'testdata';
var tb = browserify(opts);
tb.require('./test/testdata', {expose: 'testdata'});
tb.transform('brfs');

tb.bundle().pipe(fs.createWriteStream('browser/testdata.js'));




