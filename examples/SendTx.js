
// Replace '..' with 'bitcore' if you plan on using this code elsewhere.

var networks    = require('../networks');
var Peer        = require('../Peer').class();
var Transaction = require('../Transaction').class();
var Address     = require('../Address').class();
var Script      = require('../Script').class();
var coinUtil    = require('../util/util');
var PeerManager = require('../PeerManager').createClass({
  network: networks.testnet
});

var createTx = function() {

  var TXIN   = 'd05f35e0bbc495f6dcab03e599c8f5e32a07cdb4bc76964de201d06a2a7d8265';
  var TXIN_N = 0;
  var ADDR   = 'muHct3YZ9Nd5Pq7uLYYhXRAxeW4EnpcaLz';
  var VAL    = '1.234';

  var txobj = {
    version:   1,
    lock_time: 0,
    ins:       [],
    outs:      []
  }

  var txin = {
    s: coinUtil.EMPTY_BUFFER, // Add signature
    q: 0xffffffff
  };

  var hash = new Buffer(TXIN.split('').reverse(), 'hex');

  var vout    = parseInt(TXIN_N);
  var voutBuf = new Buffer(4);

  voutBuf.writeUInt32LE(vout, 0);
  txin.o = Buffer.concat([hash, voutBuf]);
  txobj.ins.push(txin);

  var addr     = new Address(ADDR);
  var script   = Script.createPubKeyHashOut(addr.payload());
  var valueNum = coinUtil.parseValue(VAL);
  var value    = coinUtil.bigIntToValue(valueNum);

  var txout = {
    v: value,
    s: script.getBuffer(),
  };
  txobj.outs.push(txout);

  return new Transaction(txobj);

};

var peerman = new PeerManager();
peerman.addPeer(new Peer('127.0.0.1', 18333));

peerman.on('connect', function(conn) {

  var conn = peerman.getActiveConnection();

  if (conn) {
    conn.sendTx(createTx());
  }

  conn.on('reject', function () {
    console.log('Transaction Rejected'); 
  });

});

peerman.start();
