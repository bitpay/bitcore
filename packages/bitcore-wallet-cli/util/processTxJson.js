#!/usr/bin/env node

var fs = require('fs');
var parse = require('csv-parse');
var replace = require('replacestream');
var _ = require('lodash');
var renderAmount = function(amount) {
  var unit = process.env.BIT_UNIT || 'btc';
  if (unit === 'SAT') {
    // Do nothing
  } else if (unit === 'btc') {
    amount = amount / 1e8;
  } else {
    amount = amount / 100;
  }
  amount = (parseFloat(amount.toPrecision(12)));
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))\./g, ",") + ' ' + unit;
};


function printBal(b) {
  var total = 0;
  var neg = false;
  var l = [];
  _.each(b, function(v, k) {
    if (!v.bal) return;
    l.push({
      addr: k,
      val: v,
      ts: v.time
    });
  });
  _.each(_.sortBy(l, 'ts'), function(l) {
    console.log(" %s: %s", l.addr, renderAmount(l.val.bal));
    console.log("   %s", l.val.txs.join(','));
    total += l.val.bal;
  });
  console.log("TOTAL: %s ADDRS W/BALANCE: %d", renderAmount(total), l.length);
};


var balances = {};

var filename = process.argv[2] || './history.json';

fs.readFile(filename, {
  encoding: 'utf8'
}, function(err, data) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  var i = 0;
  var t = JSON.parse(data);
  var txs = _.flatten(t);
  console.log('\n  ## GOT %d TXS\n', txs.length);
  var l = txs.length;
  var adds= 0;

  function add(b, i, add, txid, ts) {
    adds++;
    if (!i.isMine) return 0;


    if (!b[i.address]) {
      b[i.address] = {
        bal: 0,
        txs: [],
      };
    };

    if (add) {
      b[i.address].bal += i.amount;
    } else {
      b[i.address].bal -= i.amount;
    }
    b[i.address].ts = ts;
    b[i.address].txs.push(txid);
    return 1;
  };

  var uniq = {};
  _.each(_.sortBy(txs, 'time'), function(tx) {
    //console.error(tx.txid);
    if (uniq[tx.txid]) return;
    uniq[tx.txid] = true;

    if (_.isEmpty(tx.inputs) || _.isEmpty(tx.outputs)) {
      console.log("TX WITH INPUTS OR OUTPUTS", "TX WITH NO MINE", tx);
    }

    var any = 0;
    _.each(tx.inputs, function(x) {
      any += add(balances, x, false, tx.txid, tx.time);
    });
    _.each(tx.outputs, function(x) {
      any += add(balances, x, true, tx.txid, tx.time);
    });

    if (!any) {
      console.log("TX WITH NO MINE", tx);
    }

    i++;
  });

  printBal(balances);
  console.log('## %d processed inputs/outputs', adds)
  console.log('## BALANCES AT %d/%d TXS', i, l);



});
