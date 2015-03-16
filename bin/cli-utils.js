var _ = require('lodash');
var url = require('url');
var read = require('read')
var log = require('npmlog');
var Client = require('bitcore-wallet-client');
var FileStorage = require('./filestorage');
var sjcl = require('sjcl');

var WALLET_ENCRYPTION_OPTS = {
  iter: 5000
};

var Utils = function() {};

var die = Utils.die = function(err) {
  if (err) {
    if (err.code && err.code == 'ECONNREFUSED') {
      console.error('Could not connect to Bicore Wallet Service');
    } else {
      console.error(err);
    }
    process.exit(1);
  }
};

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

  try {
    client.import(walletData);
  } catch (e) {
    die('Corrupt wallet file.');
  };
  if (doNotComplete) return cb(client);


  client.on('walletCompleted', function(wallet) {
    Utils.doSave(client, filename, password, function() {
      log.info('Your wallet has just been completed. Please backup your wallet file or use the export command.');
    });
  });
  client.openWallet(function(err, isComplete) {
    if (err) throw err;

    return cb(client);
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

  var filename = args.file || process.env['WALLET_FILE'] || process.env['HOME'] + '/.wallet.dat';
  var host = args.host || process.env['BWS_HOST'] || 'http://localhost:3001/';

  var storage = new FileStorage({
    filename: filename,
  });

  var client = new Client({
    baseUrl: url.resolve(host, '/bws/api'),
    verbose: args.verbose,
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

Utils.doSave = function(client, filename, password, cb) {
  var opts = {};

  var str = client.export();
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

Utils.saveEncrypted = function(client, filename, cb) {
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

      Utils.doSave(client, filename, password, cb);
    });
  });
};

Utils.saveClient = function(args, client, cb) {
  var filename = args.file || process.env['WALLET_FILE'] || process.env['HOME'] + '/.wallet.dat';
  console.log(' * Saving file', filename);

  if (args.password) {
    Utils.saveEncrypted(client, filename, cb);
  } else {
    Utils.doSave(client, filename, null, cb);
  };
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
    program.exit(1);
  }

  return matches[0];
};

Utils.UNITS = {
  'btc': 100000000,
  'bit': 100,
  'sat': 1,
};

Utils.parseAmount = function(text) {
  if (!_.isString(text))
    text = text.toString();

  var regex = '^(\\d*(\\.\\d{0,8})?)\\s*(' + _.keys(Utils.UNITS).join('|') + ')?$';
  var match = new RegExp(regex, 'i').exec(text.trim());

  if (!match || match.length === 0) throw new Error('Invalid amount');

  var amount = parseFloat(match[1]);
  if (!_.isNumber(amount) || _.isNaN(amount)) throw new Error('Invalid amount');

  var unit = (match[3] || 'sat').toLowerCase();
  var rate = Utils.UNITS[unit];
  if (!rate) throw new Error('Invalid unit')

  var amountSat = parseFloat((amount * rate).toPrecision(12));
  if (amountSat != Math.round(amountSat)) throw new Error('Invalid amount');

  return amountSat;
};

Utils.configureCommander = function(program) {
  program
    .version('0.0.1')
    .option('-f, --file <filename>', 'Wallet file')
    .option('-h, --host <host>', 'Bitcore Wallet Service URL (eg: http://localhost:3001/copay/api')
    .option('-v, --verbose', 'be verbose')

  return program;
};

Utils.renderAmount = function(amount) {
  var unit = process.env.BIT_UNIT || 'bit';
  if (unit === 'SAT') {
    // Do nothing
  } else if (process.env.BIT_UNIT === 'btc') {
    amount = amount / 1e8;
  } else {
    amount = amount / 100;
  }
  amount = (parseFloat(amount.toPrecision(12)));
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + ' ' + unit;
};

Utils.renderTxProposals = function(txps) {
  if (_.isEmpty(txps))
    return;

  console.log("* TX Proposals:")

  _.each(txps, function(x) {
    var missingSignatures = x.requiredSignatures - _.filter(_.values(x.actions), function(a) {
      return a.type == 'accept';
    }).length;
    console.log("\t%s [\"%s\" by %s] %s => %s", Utils.shortID(x.id), x.message, x.creatorName, Utils.renderAmount(x.amount), x.toAddress);

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
