var _ = require('lodash');
var read = require('read')
var log = require('npmlog');

var Client = require('bitcore-wallet-client');
var FileStorage = require('./filestorage');

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

Utils.getClient = function(args, cb) {
  var storage = new FileStorage({
    filename: args.file || process.env['BIT_FILE'],
  });
  var client = new Client({
    baseUrl: args.host || process.env['BIT_HOST'],
    verbose: args.verbose,
  });
  storage.load(function(err, walletData) {
    if (err && err.code != 'ENOENT') die(err);
    if (!walletData) return cb(client);

    client.import(walletData);
    client.openWallet(function(err, justCompleted) {
      if (client.isComplete() && justCompleted) {
        Utils.saveClient(args, client, function() {
          log.info('Your wallet has just been completed. Please backup your wallet file or use the export command.');
          return cb(client);
        });
      } else {
        return cb(client);
      }
    });
  });
};

Utils.saveClient = function(args, client, cb) {
  var storage = new FileStorage({
    filename: args.file || process.env['BIT_FILE'],
  });
  var str = client.export();
  storage.save(str, function(err) {
    die(err);
    return cb();
  });
};

// var setPassword;
// c.on('needPassword', function(cb) {
//   if (args.password) {
//     return cb(args.password);
//   } else {
//     if (setPassword)
//       return cb(setPassword);

//     read({
//       prompt: 'Password for ' + args.file + ' : ',
//       silent: true
//     }, function(er, password) {
//       setPassword = password;
//       return cb(password);
//     })
//   }
// });

// c.on('needNewPassword', function(cb) {
//   if (args.password) {
//     return cb(args.password);
//   } else {
//     read({
//       prompt: 'New Password: ',
//       silent: true
//     }, function(er, password) {
//       return cb(password);
//     })
//   }
// });



Utils.findOneTxProposal = function(txps, id) {
  var matches = _.filter(txps, function(tx) {
    return _.endsWith(Utils.shortID(tx.id), id);
  });

  if (!matches.length)
    Utils.die('Could not find TX Proposal:' + id);

  if (matches.length > 1)
    Utils.die('More than one TX Proposals match:' + id + ' : ' + _.map(matches, function(tx) {
      return tx.id;
    }).join(' '));;

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
    .option('-f, --file [filename]', 'Wallet file', process.env['HOME'] + '/.bit.dat')
    .option('-h, --host [host]', 'Bitcore Wallet Service URL (eg: http://localhost:3001/copay/api')
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
