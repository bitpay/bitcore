
var _ = require('lodash');
var Client = require('../lib/client');

var lib = function() {};

var die = lib.die = function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
};

lib.parseMN = function(MN) {
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


lib.shortID = function(id) {
  return id.substr(id.length - 4);
};

lib.getClient = function(args) {
  var storage = new Client.FileStorage({
    filename: args.config
  });
  return new Client({
    storage: storage,
    verbose: args.verbose
  });
}

lib.findOneTxProposal = function(txps, id) {
  var matches = _.filter(txps, function(tx) {
    return _.endsWith(lib.shortID(tx.id), id);
  });

  if (!matches.length)
    lib.die('Could not find TX Proposal:' + id);

  if (matches.length > 1)
    lib.die('More than one TX Proposals match:' + id + ' : ' + _.map(matches, function(tx) {
      return tx.id;
    }).join(' '));;

  return matches[0];
};



module.exports = lib;
