
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

  if (!m || ! n) {
    die('Bad m-n parameter');
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



module.exports = Utils;
