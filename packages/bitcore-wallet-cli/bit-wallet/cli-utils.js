var _ = require('lodash');
var Client = require('../lib/client');

var Utils = function() {};

var die = Utils.die = function(err) {
  if (err) {
    console.error(err);
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

Utils.getClient = function(args) {
  var storage = new Client.FileStorage({
    filename: args.file || process.env['BIT_FILE'],
  });
  return new Client({
    storage: storage,
    baseUrl: args.host || process.env['BIT_HOST'],
    verbose: args.verbose
  });
}

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
    .option('-f, --file [filename]', 'Wallet file', 'bit.dat')
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
    console.log('\t\tMissing signatures: ' + missingSignatures);
  });

};

module.exports = Utils;
