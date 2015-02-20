var _ = require('lodash');
var Client = require('../lib/client');

var Utils = function() {};

var die = Utils.die = function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
};

Utils.parseMN = function(MN) {
  if (!MN)
    die('No m-n parameter');
  var mn = MN.split('-');

  var m = parseInt(mn[0]);
  var n = parseInt(mn[1]);

  if (!m || !n) {
    die('Bad m-n parameter:' + MN);
  }

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
    filename: args.config || process.env['BIT_FILE'],
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


module.exports = Utils;
