'use strict';

var _ = require('lodash');

var common = function() {};


var die = common.die = function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
};

common.parseMN = function(MN) {
  if (!MN)
    die('No m-n parameter');
  var mn = MN.split('-');

  var m = parseInt(mn[0]);
  var n = parseInt(mn[1]);

  if (!m || !n) {
    die('Bad m-n parameter');
  }

  return [m, n];
};


common.shortID = function(id) {
  return id.substr(id.length - 4);
};

common.findOneTxProposal = function(txps, id) {
  var matches = _.filter(txps, function(tx) {
    return _.endsWith(common.shortID(tx.id), id);
  });

  if (!matches.length)
    common.die('Could not find TX Proposal:' + id);

  if (matches.length > 1)
    common.die('More than one TX Proposals match:' + id + ' : ' + _.map(matches, function(tx) {
      return tx.id;
    }).join(' '));;

  return matches[0];
};

module.exports = common;
