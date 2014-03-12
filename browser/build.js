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
var program = require('commander');

// concat browser vendor files
var exec = require('child_process').exec;
var sys = require('sys');
var puts = function(error, stdout, stderr) {
  if (error) console.log(error);
  sys.puts(stdout);
  sys.puts(stderr);
};

exec('cd browser; sh concat.sh', puts);

var list = function(val) {
  return val.split(',');
};

program
  .version('0.0.1')
  .option('-a, --includeall', 'Include all submodules.')
  .option('-d, --dontminify', 'Don\'t minify the code.')
  .option('-s, --submodules <items>', 'Include the listed comma-separated submodules.', list)
  .parse(process.argv);

if (!program.includeall && (!program.submodules || program.submodules.length === 0)) {
  console.log('Must use either -s or -a option. For more info use the --help option');
  process.exit(1);
}

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
  'Connection',
  'Deserialize',
  'Gruntfile',
  'Number.monkey',
  'Opcode',
  'Peer',
  'PeerManager',
  'PrivateKey',
  'RpcClient',
  'Key',
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
  'util/log',
  'util/util',
  'util/EncodedData',
  'util/VersionedData',
];

var opts = {};
opts.pack = pack;
opts.debug = true;
opts.standalone = 'bitcore';
opts.insertGlobals = true;

var b = browserify(opts);
b.require('browserify-bignum/bignumber.js', {expose: 'bignum'} );
b.require('browserify-buffertools/buffertools.js', {expose:'buffertools'});
b.require('base58-native', {expose: 'base58-native'});
b.require('./bitcore', {expose: 'bitcore'});
modules.forEach(function(m) {
  if (program.includeall || program.submodules.indexOf(m) > -1) {
    console.log('Including '+m+' in the browser bundle');
    b.require('./' + m + '.js' , {expose: './'+m} );
  }
});

if (!program.dontminify) {
  b.transform({
    global: true
  }, 'uglifyify');
}

var bundle = b.bundle();
bundle = bundle.pipe(fs.createWriteStream('browser/bundle.js'));

opts.standalone = 'testdata';
var tb = browserify(opts);
tb.require('./test/testdata', {expose: 'testdata'});
tb.transform('brfs');

tb.bundle().pipe(fs.createWriteStream('browser/testdata.js'));




