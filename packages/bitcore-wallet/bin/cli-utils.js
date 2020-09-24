var _ = require('lodash');
var url = require('url');
var read = require('read')
var log = require('npmlog');
var Client = require('bitcore-wallet-client').default;
const Key = Client.Key;
var FileStorage = require('./filestorage');
var sjcl = require('sjcl');

var WALLET_ENCRYPTION_OPTS = {
  iter: 5000
};

var Utils = function() {};

var die = Utils.die = function(err) {
  if (err) {
    if (err.code && err.code == 'ECONNREFUSED') {
      console.error('!! Could not connect to Bicore Wallet Service');
    } else {
      console.log('!! ' + err.toString());
    }
    process.exit(1);
  }
};

Utils.create = function(client, opts) {
  let key = Key.create();
  let cred = key.createCredentials(null, opts);
  client.fromString(cred);

  return {key, cred};
}

Utils.parseMN = function(text) {

  if (!text) throw new Error('No m-n parameter');

  var regex = /^(\d+)(-|of|-of-)?(\d+)$/i;
  var match = regex.exec(text.trim());

  if (!match || match.length === 0) throw new Error('Invalid m-n parameter');

  var m = parseInt(match[1]);
  var n = parseInt(match[3]);
  if (m > n) throw new Error('Invalid m-n parameter');

  return [m, n];
};


Utils.shortID = function(id) {
  return id.substr(id.length - 4);
};

Utils.confirmationId = function(copayer) {
  return parseInt(copayer.xPubKeySignature.substr(-4), 16).toString().substr(-4);
}


Utils.doLoad = function(client, doNotComplete, walletData, password, filename, cb) {
  if (password) {
    try {
      walletData = sjcl.decrypt(password, walletData);
    } catch (e) {
      die('Could not open wallet. Wrong password.');
    }
  }

  let key;
  try {
    walletData = JSON.parse(walletData);
    let imported = Client.upgradeCredentialsV1(walletData);
    client.fromString(JSON.stringify(imported.credentials));

    key = Key.fromObj(imported.key);
  } catch (e) {
    try {
      client.fromObj(walletData.cred);
      key = Key.fromObj(walletData.key);
    } catch (e) {
      die('Corrupt wallet file:' + e);
    };
  };
  if (doNotComplete) return cb(client, key);


  client.on('walletCompleted', function(wallet) {
    Utils.doSave(key, client, filename, password, function() {
      log.info('Your wallet has just been completed. Please backup your wallet file or use the export command.');
    });
  });
  client.openWallet(function(err, isComplete) {
    if (err) throw err;

    return cb(client, key);
  });
};

Utils.loadEncrypted = function(client, opts, walletData, filename, cb) {
  read({
    prompt: 'Enter password to decrypt:',
    silent: true
  }, function(er, password) {
    if (er) die(err);
    if (!password) die("no password given");

    return Utils.doLoad(client, opts.doNotComplete, walletData, password, filename, cb);
  });
};

Utils.getClient = function(args, opts, cb) {
  opts = opts || {};

  var filename = args.file || process.env['WALLET_FILE'] || process.env['HOME'] + '/.wallet.json';
  var host = args.host || 'https://bws.bitpay.com/';

  var storage = new FileStorage({
    filename: filename,
  });

  var client = new Client({
    baseUrl: process.env['BWS_HOST'] || url.resolve(host, '/bws/api'),
    verbose: args.verbose,
    supportStaffWalletId: opts.walletId,
    timeout: 20 * 60 * 1000,
    // timeout: 1000,
  });

  storage.load(function(err, walletData) {
    if (err) {
      if (err.code == 'ENOENT') {
        if (opts.mustExist) {
          die('File "' + filename + '" not found.');
        }
      } else {
        die(err);
      }
    }

    if (walletData && opts.mustBeNew) {
      die('File "' + filename + '" already exists.');
    }
    if (!walletData) return cb(client);

    var json;
    try {
      json = JSON.parse(walletData);
    } catch (e) {
      die('Invalid input file');
    };

    if (json.ct) {
      Utils.loadEncrypted(client, opts, walletData, filename, cb);
    } else {
      Utils.doLoad(client, opts.doNotComplete, walletData, null, filename, cb);
    }
  });
};

Utils.doSave = function(key, cred, filename, password, cb) {
  var opts = {};
  var str = JSON.stringify({key: key.toObj(), cred: cred.toObj()});
  if (password) {
    str = sjcl.encrypt(password, str, WALLET_ENCRYPTION_OPTS);
  }

  var storage = new FileStorage({
    filename: filename,
  });

  storage.save(str, function(err) {
    die(err);
    return cb();
  });
};

Utils.saveEncrypted = function(key, cred, filename, cb) {
  read({
    prompt: 'Enter password to encrypt:',
    silent: true
  }, function(er, password) {
    if (er) Utils.die(err);
    if (!password) Utils.die("no password given");
    read({
      prompt: 'Confirm password:',
      silent: true
    }, function(er, password2) {
      if (er) Utils.die(err);
      if (password != password2)
        Utils.die("passwords were not equal");

      Utils.doSave(key, cred, filename, password, cb);
    });
  });
};

Utils.saveClient = function(args, key, cred, opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }

  var filename = args.file || process.env['WALLET_FILE'] || process.env['HOME'] + '/.wallet.json';

  var storage = new FileStorage({
    filename: filename,
  });

  console.log(' * Saving file', filename);

  storage.exists(function(exists) {
    if (exists && opts.doNotOverwrite) {
      console.log(' * File already exists! Please specify a new filename using the -f option.');
      return cb();
    }

    if (args.password) {
      Utils.saveEncrypted(client, filename, cb);
    } else {
      Utils.doSave(key, cred, filename, null, cb);
    };
  });
};

Utils.findOneTxProposal = function(txps, id) {
  var matches = _.filter(txps, function(tx) {
    return _.endsWith(Utils.shortID(tx.id), id);
  });

  if (!matches.length)
    Utils.die('Could not find TX Proposal:' + id);

  if (matches.length > 1) {
    console.log('More than one TX Proposals match:' + id);
    Utils.renderTxProposals(txps);
    process.exit(1);
  }

  return matches[0];
};

Utils.UNITS2 = {
  'btc': 100000000,
  'bit': 100,
  'sat': 1,
};

Utils.parseAmount = function(text, coin) {
  if (!_.isString(text))
    text = text.toString();

  var regex = '^(\\d*(\\.\\d{0,8})?)\\s*(' + _.keys(Utils.UNITS2).join('|') + ')?$';
  var match = new RegExp(regex, 'i').exec(text.trim());

  if (!match || match.length === 0) {
    Utils.die('Invalid amount: ' + text);
  }

  var amount = parseFloat(match[1]);
  if (!_.isNumber(amount) || _.isNaN(amount)) throw new Error('Invalid amount');

  var unit = (match[3] || 'sat').toLowerCase();
  var rate = Utils.UNITS2[unit];
  if (!rate) {
    Utils.die('Invalid unit: ' + unit);
  }

  var amountSat = parseFloat((amount * rate).toPrecision(12));
  if (amountSat != Math.round(amountSat)) {
    Utils.die('Invalid amount: ' + amount + ' ' + unit);
  }

  return amountSat;
};

Utils.configureCommander = function(program) {
  program
    .version('0.0.1')
    .option('-f, --file <filename>', 'Wallet file')
    .option('-h, --host <host>', 'Bitcore Wallet Service URL (eg: http://localhost:3232/bws/api ')
    .option('-v, --verbose', 'be verbose')

  return program;
};

Utils.COIN = {
  bch: {
    name: 'bch',
    toSatoshis: 100000000,
    maxDecimals: 8,
    minDecimals: 8,
  },
  btc: {
    name: 'btc',
    toSatoshis: 100000000,
    maxDecimals: 8,
    minDecimals: 8,
  },
  bit: {
    name: 'bit',
    toSatoshis: 100,
    maxDecimals: 2,
    minDecimals: 2,
  },
  bch: {
    name: 'bch',
    toSatoshis: 100000000,
    maxDecimals: 8,
    minDecimals: 8,
  },
  eth: {
    name: 'eth',
    toSatoshis: 1e18,
    maxDecimals: 8,
    minDecimals: 8,
  },
 
 
};

Utils.renderAmount = function(satoshis, coin, opts) {
  function clipDecimals(number, decimals) {
    var x = number.toString().split('.');
    var d = (x[1] || '0').substring(0, decimals);
    return parseFloat(x[0] + '.' + d);
  };

  function addSeparators(nStr, thousands, decimal, minDecimals) {
    nStr = nStr.replace('.', decimal);
    var x = nStr.split(decimal);
    var x0 = x[0];
    var x1 = x[1];

    x1 = _.dropRightWhile(x1, function(n, i) {
      return n == '0' && i >= minDecimals;
    }).join('');
    var x2 = x.length > 1 ? decimal + x1 : '';

    x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return x0 + x2;
  };

  opts = opts || {};

  var coin = coin || 'btc';
  var u = Utils.COIN[coin] || Utils.COIN.btc;
  var amount = clipDecimals((satoshis / u.toSatoshis), u.maxDecimals).toFixed(u.maxDecimals);
  return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u.minDecimals) + ' ' + u.name;
};

Utils.renderTxProposals = function(txps) {
  if (_.isEmpty(txps))
    return;

  console.log("* TX Proposals:")

  _.each(txps, function(x) {
    var missingSignatures = x.requiredSignatures - _.filter(_.values(x.actions), function(a) {
      return a.type == 'accept';
    }).length;
    console.log("\t%s [\"%s\" by %s] %s => %s", Utils.shortID(x.id), x.message, x.creatorName, Utils.renderAmount(x.amount), x.outputs[0].toAddress);

    if (!_.isEmpty(x.actions)) {
      console.log('\t\tActions: ', _.map(x.actions, function(a) {
        return a.copayerName + ' ' + (a.type == 'accept' ? '✓' : '✗') + (a.comment ? ' (' + a.comment + ')' : '');
      }).join('. '));
    }
    if (missingSignatures > 0) {
      console.log('\t\tMissing signatures: ' + missingSignatures);
    } else {
      console.log('\t\tReady to broadcast');
    }
  });

};

module.exports = Utils;
