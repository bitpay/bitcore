'use strict';

var fs = require('fs');
var browserify = require('browserify');
var browserPack = require('browser-pack');
var exec = require('child_process').exec;
var sys = require('sys');
var puts = function(error, stdout, stderr) {
  if (error) console.log(error);
  //sys.puts(stdout);
  //sys.puts(stderr);
};

var pack = function (params) {
  var file = require.resolve('soop');
  var dir = file.substr(0, file.length - String('soop.js').length);
  var preludePath = dir + 'example/custom_prelude.js';
  params.raw = true;
  params.sourceMapPrefix = '//#';
  params.prelude = fs.readFileSync(preludePath, 'utf8');
  params.preludePath = preludePath;
  return browserPack(params);
};

var modules = [
  'Address',
  'BIP32',
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
  'Point',
  'SIN',
  'SINKey',
  'Script',
  'ScriptInterpreter',
  'Sign',
  'Transaction',
  'TransactionBuilder',
  'Wallet',
  'WalletKey',
  'config',
  'const',
  'networks',
  'util/log',
  'util/util',
  'util/EncodedData',
  'util/VersionedData',
  'util/BinaryParser',
];

var createBitcore = function(opts) {


  opts.dir = opts.dir || '';

  // concat browser vendor files
  var cwd = process.cwd();
  process.chdir(opts.dir + 'browser');
  exec('sh concat.sh', puts);
  process.chdir(cwd);

  if (!opts.includeall && (!opts.submodules || opts.submodules.length === 0)) {
    if (!opts.stdout) console.log('Must use either -s or -a option. For more info use the --help option');
    process.exit(1);
  }

  if (opts.submodules) {
    for (var i = 0; i < opts.submodules.length; i++) {
      var sm = opts.submodules[i];
      if (modules.indexOf(sm) === -1) throw new Error('Unknown submodule ' + sm);
    }
  }

  var bopts = {
    pack: pack,
    debug: true,
    standalone: 'bitcore',
    insertGlobals: true
  };
  var b = browserify(bopts);

  b.require(opts.dir + 'browserify-bignum/bignumber.js', {
    expose: 'bignum'
  });
  b.require(opts.dir + 'browserify-buffertools/buffertools.js', {
    expose: 'buffertools'
  });
  b.require(opts.dir + 'bufferput', {
    expose: 'bufferput'
  });
  b.require(opts.dir + 'base58-native', {
    expose: 'base58-native'
  });
  b.require(opts.dir + 'buffers', {
    expose: 'buffers'
  });
  b.require('./' + opts.dir + 'bitcore', {
    expose: 'bitcore'
  });
  modules.forEach(function(m) {
    if (opts.includeall || opts.submodules.indexOf(m) > -1) {
      if (!opts.stdout) console.log('Including ' + m + ' in the browser bundle');
      b.require('./' + opts.dir + m + '.js', {
        expose: './' + m
      });
    }
  });

  if (!opts.dontminify) {
    b.transform({
      global: true
    }, 'uglifyify');
  }

  var bundle = b.bundle();
  return bundle;
};

var createTestData = function() {
  var bopts = {
    pack: pack,
    debug: true,
    standalone: 'testdata',
    insertGlobals: true
  };
  var tb = browserify(bopts);
  tb.require('./test/testdata', {
    expose: 'testdata'
  });
  tb.transform('brfs');

  return tb.bundle();
};



if (require.main === module) {
  var list = function(val) {
    return val.split(',');
  };
  var program = require('commander');
  program
    .version('0.0.1')
    .option('-a, --includeall', 'Include all submodules.')
    .option('-d, --dontminify', 'Don\'t minify the code.')
    .option('-o, --stdout', 'Specify output as stdout')
    .option('-D, --dir <dir>', 'Specify a base directory')
    .option('-s, --submodules <items>', 'Include the listed comma-separated submodules.', list)
    .parse(process.argv);
  if (!program.stdout) {
    var testBundle = createTestData(program);
    testBundle.pipe(fs.createWriteStream('browser/testdata.js'));
  }
  var bitcoreBundle = createBitcore(program);
  bitcoreBundle.pipe(program.stdout ? process.stdout : fs.createWriteStream('browser/bundle.js'));
}

module.exports.createBitcore = createBitcore;
module.exports.createTestData = createTestData;
